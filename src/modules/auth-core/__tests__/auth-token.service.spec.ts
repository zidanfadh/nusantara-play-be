/**
 * AuthTokenService (Phase 09) with the database mocked: SQL shape and every
 * branch. The real race (two parallel consumes) and the invalidation of
 * older tokens are covered by test/integration/email-flows.int-spec.ts.
 */
import {
  AUTH_TOKEN_CLEANUP_AFTER_DAYS,
  AuthTokenService,
  hashAuthToken,
} from '../auth-token.service';
import { fakeConfig } from './helpers';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function setup(env: Record<string, string | undefined> = {}) {
  const expiresAt = new Date('2026-11-19T00:00:00Z');
  const txQuery = jest
    .fn()
    .mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('INSERT') ? [{ expires_at: expiresAt }] : [],
      ),
    );
  const manager = { query: txQuery };
  const dataSource = {
    manager: { query: jest.fn() },
    query: jest.fn(),
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  const service = new AuthTokenService(dataSource as never, fakeConfig(env));
  return { service, dataSource, txQuery, expiresAt };
}

describe('hashAuthToken', () => {
  it('is the SHA-256 hex digest (64 characters)', () => {
    expect(hashAuthToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('AuthTokenService.ttlMinutes', () => {
  it('defaults: verification 24 h = 1440 min, reset 60 min', () => {
    const { service } = setup();
    expect(service.ttlMinutes('email_verification')).toBe(1440);
    expect(service.ttlMinutes('password_reset')).toBe(60);
  });

  it('reads EMAIL_VERIFICATION_TTL_HOURS and PASSWORD_RESET_TTL_MINUTES', () => {
    const { service } = setup({
      EMAIL_VERIFICATION_TTL_HOURS: '2',
      PASSWORD_RESET_TTL_MINUTES: '15',
    });
    expect(service.ttlMinutes('email_verification')).toBe(120);
    expect(service.ttlMinutes('password_reset')).toBe(15);
  });
});

describe('AuthTokenService.create', () => {
  it('locks per (user, type), deletes older UNUSED tokens of that type, inserts only the hash', async () => {
    const t = setup();
    const created = await t.service.create(
      USER_ID,
      'password_reset',
      '203.0.113.9',
    );
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.expiresAt).toBe(t.expiresAt);
    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);

    const calls = t.txQuery.mock.calls as [string, unknown[]][];
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(calls[0][1]).toEqual([USER_ID, 'password_reset']);
    expect(calls[1][0]).toMatch(
      /DELETE FROM auth_tokens\s+WHERE user_id = \$1 AND type = \$2 AND used_at IS NULL/,
    );
    expect(calls[2][0]).toContain('INSERT INTO auth_tokens');
    expect(calls[2][1]).toEqual([
      USER_ID,
      'password_reset',
      hashAuthToken(created.token),
      60,
      '203.0.113.9',
    ]);
    // The raw token is never sent to the database.
    expect(JSON.stringify(calls)).not.toContain(created.token);
  });

  it('stores no IP when it is missing or not an IP address', async () => {
    const t = setup();
    await t.service.create(USER_ID, 'email_verification', 'not-an-ip');
    await t.service.create(USER_ID, 'email_verification');
    const inserts = (t.txQuery.mock.calls as [string, unknown[]][]).filter(
      ([sql]) => sql.includes('INSERT'),
    );
    expect(inserts.map(([, params]) => params[4])).toEqual([null, null]);
    expect(inserts[0][1][3]).toBe(1440);
  });

  it('every call returns a different token', async () => {
    const t = setup();
    const a = await t.service.create(USER_ID, 'email_verification');
    const b = await t.service.create(USER_ID, 'email_verification');
    expect(a.token).not.toBe(b.token);
  });
});

describe('AuthTokenService.consume', () => {
  it('ONE conditional UPDATE (unused, not expired, right type) returning the user id', async () => {
    const t = setup();
    t.dataSource.manager.query.mockResolvedValue([[{ user_id: USER_ID }], 1]);
    await expect(
      t.service.consume('raw-token', 'email_verification'),
    ).resolves.toBe(USER_ID);
    const [sql, params] = t.dataSource.manager.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toMatch(/UPDATE auth_tokens\s+SET used_at = now\(\)/);
    expect(sql).toContain('used_at IS NULL AND expires_at > now()');
    expect(sql).toContain('type = $2');
    expect(sql).toContain('RETURNING user_id');
    expect(params).toEqual([hashAuthToken('raw-token'), 'email_verification']);
  });

  it('null when no row matched (unknown, used, expired or other type)', async () => {
    const t = setup();
    t.dataSource.manager.query.mockResolvedValue([[], 0]);
    await expect(
      t.service.consume('raw-token', 'password_reset'),
    ).resolves.toBeNull();
  });

  it('uses the given transaction manager and accepts a plain rows array', async () => {
    const t = setup();
    const manager = {
      query: jest.fn().mockResolvedValue([{ user_id: USER_ID }]),
    };
    await expect(
      t.service.consume('raw-token', 'password_reset', manager as never),
    ).resolves.toBe(USER_ID);
    expect(t.dataSource.manager.query).not.toHaveBeenCalled();
  });
});

describe('AuthTokenService.peek', () => {
  it('read-only SELECT of a valid token; null when none', async () => {
    const t = setup();
    t.dataSource.manager.query
      .mockResolvedValueOnce([{ user_id: USER_ID }])
      .mockResolvedValueOnce([]);
    await expect(t.service.peek('raw', 'password_reset')).resolves.toBe(
      USER_ID,
    );
    await expect(t.service.peek('raw', 'password_reset')).resolves.toBeNull();
    const [sql] = t.dataSource.manager.query.mock.calls[0] as [string];
    expect(sql).toMatch(/^\s*SELECT user_id FROM auth_tokens/);
    expect(sql).not.toContain('UPDATE');
  });
});

describe('AuthTokenService.cleanup', () => {
  it('deletes tokens used or expired more than 7 days ago and returns the count', async () => {
    const t = setup();
    t.dataSource.query.mockResolvedValue([[], 4]);
    const now = new Date('2026-11-18T03:15:00Z');
    await expect(t.service.cleanup(now)).resolves.toBe(4);
    const [sql, params] = t.dataSource.query.mock.calls[0] as [string, Date[]];
    expect(sql).toContain(
      'expires_at < $1 OR (used_at IS NOT NULL AND used_at < $1)',
    );
    expect(now.getTime() - params[0].getTime()).toBe(
      AUTH_TOKEN_CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it('0 when the driver reports no count', async () => {
    const t = setup();
    t.dataSource.query.mockResolvedValue([[]]);
    await expect(t.service.cleanup()).resolves.toBe(0);
  });
});
