/**
 * RefreshTokenService (Phase 07) against the real local test database:
 * issue, rotate, parallel rotation (refresh_conflict), reuse detection,
 * expiry and cleanup. REFRESH_REUSE_GRACE_SECONDS = 20 (test/test-env.ts).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import {
  hashRefreshToken,
  RefreshTokenService,
} from '../../src/modules/auth-core/refresh-token.service';
import { RefreshToken } from '../../src/modules/auth-core/entities/refresh-token.entity';
import {
  RefreshConflictError,
  RefreshTokenInvalidError,
} from '../../src/modules/auth-core/auth-errors';
import { User } from '../../src/modules/users/entities/user.entity';
import { Fixtures } from './fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('RefreshTokenService (integration, real database, Phase 07)', () => {
  let moduleRef: TestingModule;
  let service: RefreshTokenService;
  let dataSource: DataSource;
  let fx: Fixtures;
  let user: User;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
        TypeOrmModule.forFeature([RefreshToken]),
      ],
      providers: [RefreshTokenService],
    }).compile();
    service = moduleRef.get(RefreshTokenService);
    dataSource = moduleRef.get(DataSource);
    fx = new Fixtures(dataSource);
    user = await fx.user();
  });

  afterAll(async () => {
    // Deleting the user cascades to its refresh tokens.
    await fx.cleanup();
    await moduleRef.close();
  });

  const repo = () => dataSource.getRepository(RefreshToken);
  const rowOf = (raw: string) =>
    repo().findOneByOrFail({ token_hash: hashRefreshToken(raw) });
  const familyRows = (familyId: string) =>
    repo().find({
      where: { family_id: familyId },
      order: { created_at: 'ASC' },
    });

  it('issue() starts a family and stores only the SHA-256 hash', async () => {
    const issued = await service.issue(user.id, {
      userAgent: 'jest',
      ip: '203.0.113.7',
    });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
    const row = await repo().findOneByOrFail({ id: issued.id });
    expect(row.token_hash).toBe(hashRefreshToken(issued.token));
    expect(row.token_hash).not.toContain(issued.token);
    expect(row.family_id).toBe(issued.familyId);
    expect(row.user_id).toBe(user.id);
    expect(row.revoked_at).toBeNull();
    expect(row.user_agent).toBe('jest');
    expect(row.ip).toBe('203.0.113.7');
    const days = (row.expires_at.getTime() - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);

    const other = await service.issue(user.id, { ip: 'not-an-ip' });
    expect(other.familyId).not.toBe(issued.familyId);
    expect((await repo().findOneByOrFail({ id: other.id })).ip).toBeNull();
  });

  it('rotate() revokes the old token (rotated, replaced_by_id) and issues one in the same family', async () => {
    const first = await service.issue(user.id);
    const second = await service.rotate(first.token, { userAgent: 'tab-1' });
    expect(second.familyId).toBe(first.familyId);
    expect(second.token).not.toBe(first.token);

    const old = await rowOf(first.token);
    expect(old.revoked_at).not.toBeNull();
    expect(old.revoked_reason).toBe('rotated');
    expect(old.replaced_by_id).toBe(second.id);
    expect((await rowOf(second.token)).revoked_at).toBeNull();

    // The new token rotates again.
    const third = await service.rotate(second.token);
    expect(third.familyId).toBe(first.familyId);
  });

  it('2 parallel rotations of one token -> exactly one new token, the other gets refresh_conflict, family stays valid', async () => {
    const start = await service.issue(user.id);
    const results = await Promise.allSettled([
      service.rotate(start.token),
      service.rotate(start.token),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = rejected[0].reason as unknown;
    expect(reason).toBeInstanceOf(RefreshConflictError);
    expect((reason as RefreshConflictError).getStatus()).toBe(409);
    expect((reason as RefreshConflictError).getResponse()).toMatchObject({
      error: 'refresh_conflict',
    });

    const rows = await familyRows(start.familyId);
    expect(rows).toHaveLength(2); // the original + exactly one new token
    expect(rows.filter((r) => r.revoked_at === null)).toHaveLength(1);
    expect(rows.some((r) => r.revoked_reason === 'reuse_detected')).toBe(false);

    // Client retries with the newer token: works.
    const winner = (fulfilled[0] as PromiseFulfilledResult<{ token: string }>)
      .value;
    await expect(service.rotate(winner.token)).resolves.toMatchObject({
      familyId: start.familyId,
    });
  });

  it('a second use within the grace window -> refresh_conflict without revoking the family', async () => {
    const first = await service.issue(user.id);
    const second = await service.rotate(first.token);
    await expect(service.rotate(first.token)).rejects.toBeInstanceOf(
      RefreshConflictError,
    );
    expect((await rowOf(second.token)).revoked_at).toBeNull();
  });

  it('reuse after the grace window -> whole family revoked (reuse_detected) and 401', async () => {
    const first = await service.issue(user.id);
    const second = await service.rotate(first.token);
    const third = await service.rotate(second.token);
    // Pretend the first rotation happened a minute ago (grace = 20 s).
    await repo().update(
      { token_hash: hashRefreshToken(first.token) },
      { revoked_at: new Date(Date.now() - 60_000) },
    );

    const reuse = service.rotate(first.token);
    await expect(reuse).rejects.toBeInstanceOf(RefreshTokenInvalidError);
    await expect(reuse).rejects.toMatchObject({ reason: 'reuse_detected' });

    const rows = await familyRows(first.familyId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);
    expect((await rowOf(third.token)).revoked_reason).toBe('reuse_detected');

    // The thief's (or victim's) newest token no longer works either.
    await expect(service.rotate(third.token)).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
  });

  it('an expired token -> 401, nothing revoked', async () => {
    const issued = await service.issue(user.id);
    await repo().update(
      { id: issued.id },
      { expires_at: new Date(Date.now() - 1000) },
    );
    const attempt = service.rotate(issued.token);
    await expect(attempt).rejects.toBeInstanceOf(RefreshTokenInvalidError);
    await expect(attempt).rejects.toMatchObject({ reason: 'expired' });
    expect((await rowOf(issued.token)).revoked_at).toBeNull();
  });

  it('an unknown token -> 401', async () => {
    await expect(
      service.rotate('definitely-not-a-real-token'),
    ).rejects.toMatchObject({ reason: 'unknown', status: 401 });
  });

  it('revokeFamily() and revokeAllForUser() revoke only active tokens', async () => {
    const a = await service.issue(user.id);
    await service.rotate(a.token);
    expect(await service.revokeFamily(a.familyId, 'logout')).toBe(1);
    expect(await service.revokeFamily(a.familyId, 'logout')).toBe(0);

    const other = await fx.user();
    const mine = await service.issue(user.id);
    const theirs = await service.issue(other.id);
    const count = await service.revokeAllForUser(user.id, 'password_changed');
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await rowOf(mine.token)).revoked_reason).toBe('password_changed');
    expect((await rowOf(theirs.token)).revoked_at).toBeNull();
  });

  it('cleanupExpired() deletes only tokens expired more than 7 days ago', async () => {
    const old = await service.issue(user.id);
    const recent = await service.issue(user.id);
    const valid = await service.issue(user.id);
    await repo().update(
      { id: old.id },
      { expires_at: new Date(Date.now() - 8 * DAY_MS) },
    );
    await repo().update(
      { id: recent.id },
      { expires_at: new Date(Date.now() - 6 * DAY_MS) },
    );

    const deleted = await service.cleanupExpired();
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await repo().findOneBy({ id: old.id })).toBeNull();
    expect(await repo().findOneBy({ id: recent.id })).not.toBeNull();
    expect(await repo().findOneBy({ id: valid.id })).not.toBeNull();
  });
});
