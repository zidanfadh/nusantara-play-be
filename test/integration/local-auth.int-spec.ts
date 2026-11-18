/**
 * LocalAuthService (Phase 08) against the real local test database: the
 * atomic failed-login counter under parallel load, the registration race,
 * Supabase-only accounts, case variants and the bcrypt -> Argon2id rehash.
 * LOGIN_MAX_FAILED = 5, LOGIN_LOCK_MINUTES = 15 (defaults).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { KeyService } from '../../src/modules/auth-core/key.service';
import { LocalAuthService } from '../../src/modules/auth-core/local-auth.service';
import { PasswordService } from '../../src/modules/auth-core/password.service';
import { RefreshTokenService } from '../../src/modules/auth-core/refresh-token.service';
import { TokenService } from '../../src/modules/auth-core/token.service';
import { RefreshToken } from '../../src/modules/auth-core/entities/refresh-token.entity';
import { UserCredential } from '../../src/modules/auth-core/entities/user-credential.entity';
import { User } from '../../src/modules/users/entities/user.entity';

const PASSWORD = 'correct horse battery';

describe('LocalAuthService (integration, real database, Phase 08)', () => {
  let moduleRef: TestingModule;
  let service: LocalAuthService;
  let passwords: PasswordService;
  let dataSource: DataSource;
  const emails: string[] = [];

  const newEmail = (label: string) => {
    const email = `int-auth-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(email);
    return email;
  };
  const usersWithEmail = (email: string) =>
    dataSource.query<{ id: string; supabase_user_id: string | null }[]>(
      `SELECT id, supabase_user_id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
  const credentialOf = (userId: string) =>
    dataSource.getRepository(UserCredential).findOneBy({ user_id: userId });

  async function registered(label: string): Promise<User> {
    const email = newEmail(label);
    await service.register({ email, password: PASSWORD, full_name: label });
    return dataSource.getRepository(User).findOneByOrFail({ email });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
        TypeOrmModule.forFeature([User, UserCredential, RefreshToken]),
      ],
      providers: [
        KeyService,
        TokenService,
        PasswordService,
        RefreshTokenService,
        LocalAuthService,
      ],
    }).compile();
    service = moduleRef.get(LocalAuthService);
    passwords = moduleRef.get(PasswordService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    // Credentials and refresh tokens cascade with the user.
    if (emails.length) {
      await dataSource.query(`DELETE FROM users WHERE LOWER(email) = ANY($1)`, [
        emails.map((e) => e.toLowerCase()),
      ]);
    }
    await moduleRef.close();
  });

  it('10 parallel wrong-password logins -> failed_login_count is exactly 10 and the account is locked', async () => {
    const user = await registered('parallel');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        service.login(user.email, 'wrong password!!'),
      ),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    for (const r of results) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
        UnauthorizedException,
      );
    }

    const credential = await credentialOf(user.id);
    expect(credential?.failed_login_count).toBe(10);
    expect(credential?.locked_until).not.toBeNull();
    const lockMinutes =
      (credential!.locked_until!.getTime() - Date.now()) / 60_000;
    expect(lockMinutes).toBeGreaterThan(14);
    expect(lockMinutes).toBeLessThanOrEqual(15);

    // Locked: even the correct password is refused, counter unchanged.
    await expect(service.login(user.email, PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect((await credentialOf(user.id))?.failed_login_count).toBe(10);
  });

  it('the lock starts exactly at the 5th failure; a correct login resets counter and lock', async () => {
    const user = await registered('threshold');
    for (let i = 1; i <= 4; i += 1) {
      const result = await service.recordFailedAttempt(user.id);
      expect(result).toEqual({ failedLoginCount: i, lockedUntil: null });
    }
    // Correct password after 4 failures: allowed, counter back to 0.
    await service.login(user.email, PASSWORD);
    let credential = await credentialOf(user.id);
    expect(credential?.failed_login_count).toBe(0);
    expect(credential?.locked_until).toBeNull();

    for (let i = 1; i <= 5; i += 1) {
      await service.recordFailedAttempt(user.id);
    }
    credential = await credentialOf(user.id);
    expect(credential?.failed_login_count).toBe(5);
    expect(credential?.locked_until).not.toBeNull();

    // After the lock expires a correct password works and resets both.
    await dataSource.query(
      `UPDATE user_credentials SET locked_until = now() - interval '1 second' WHERE user_id = $1`,
      [user.id],
    );
    const session = await service.login(user.email.toUpperCase(), PASSWORD);
    expect(session.user.id).toBe(user.id);
    credential = await credentialOf(user.id);
    expect(credential?.failed_login_count).toBe(0);
    expect(credential?.locked_until).toBeNull();
  });

  it('register race: 2 parallel registrations of one email -> exactly one user, both calls resolve the same way', async () => {
    const email = newEmail('race');
    const results = await Promise.allSettled([
      service.register({ email, password: PASSWORD, full_name: 'Race A' }),
      service.register({
        email: `  ${email.toUpperCase()} `,
        password: PASSWORD,
        full_name: 'Race B',
      }),
    ]);
    expect(results).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ]);
    const rows = await usersWithEmail(email);
    expect(rows).toHaveLength(1);
    expect(await credentialOf(rows[0].id)).not.toBeNull();
  });

  it('register with the email of an existing Supabase-only user creates and changes NOTHING', async () => {
    const email = newEmail('supabase-only');
    const existing = await dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email: email.replace('int-auth', 'Int-Auth'), // stored with other case
      full_name: 'Supabase Only',
    });
    const before = await dataSource.getRepository(User).findOneByOrFail({
      id: existing.id,
    });
    const usersBefore = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM users`,
    );

    await service.register({
      email,
      password: PASSWORD,
      full_name: 'Attacker',
    });

    const usersAfter = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM users`,
    );
    expect(usersAfter[0].n).toBe(usersBefore[0].n);
    expect(await credentialOf(existing.id)).toBeNull();
    const after = await dataSource.getRepository(User).findOneByOrFail({
      id: existing.id,
    });
    expect(after).toEqual(before);

    // And that user cannot log in through the new endpoint (generic 401).
    await expect(service.login(email, PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('case variants of one email in the users table -> login refused (generic 401)', async () => {
    const email = newEmail('variants');
    const lower = await registered('variants-base');
    await dataSource.query(`UPDATE users SET email = $1 WHERE id = $2`, [
      email,
      lower.id,
    ]);
    await dataSource.getRepository(User).save({
      supabase_user_id: null,
      email: email.toUpperCase(),
      full_name: 'Variant',
    });
    await expect(service.login(email, PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('a legacy bcrypt hash logs in once and is replaced by Argon2id', async () => {
    const user = await registered('bcrypt');
    await dataSource.getRepository(UserCredential).update(
      { user_id: user.id },
      {
        password_hash: await bcrypt.hash(PASSWORD, 4),
        password_algo: 'bcrypt',
      },
    );
    await service.login(user.email, PASSWORD);
    const credential = await credentialOf(user.id);
    expect(credential?.password_algo).toBe('argon2id');
    expect(credential?.password_hash.startsWith('$argon2id$')).toBe(true);
    await expect(
      passwords.verify(credential!.password_hash, 'argon2id', PASSWORD),
    ).resolves.toEqual({ ok: true, needsRehash: false });
  });

  it('login and refresh update last_login_at', async () => {
    const user = await registered('last-login');
    expect(user.last_login_at).toBeNull();
    const session = await service.login(user.email, PASSWORD);
    const afterLogin = (
      await dataSource.getRepository(User).findOneByOrFail({ id: user.id })
    ).last_login_at;
    expect(afterLogin).not.toBeNull();
    expect(session.user.last_login_at).toEqual(afterLogin);

    await dataSource.query(
      `UPDATE users SET last_login_at = '2020-01-01' WHERE id = $1`,
      [user.id],
    );
    await service.refresh(session.refreshToken.token);
    const afterRefresh = (
      await dataSource.getRepository(User).findOneByOrFail({ id: user.id })
    ).last_login_at;
    expect(afterRefresh.getFullYear()).toBeGreaterThan(2020);
  });
});
