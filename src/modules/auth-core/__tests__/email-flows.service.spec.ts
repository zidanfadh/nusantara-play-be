/**
 * EmailFlowsService (Phase 09): every branch of the registration hooks,
 * resend-verification, forgot-password, verify-email, reset-password and the
 * "password changed" email, with the database and services mocked. The real
 * SQL is covered by test/integration/email-flows.int-spec.ts and the HTTP
 * flows by test/email-flows.e2e-spec.ts.
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { InvalidOrExpiredTokenError } from '../auth-errors';
import * as authUsers from '../auth-users';
import * as verification from '../email-verification';
import {
  EmailFlowsService,
  PASSWORD_RESET_REVOKE_REASON,
} from '../email-flows.service';
import { fakeConfig } from './helpers';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BASE = 'https://app.example.test';
const RAW = 'RAW-TOKEN-abcdefghijklmnopqrstuvwxyz0123456';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'Ani@Example.test',
    full_name: 'Ani',
    role: UserRole.PUBLIK,
    status: UserStatus.ACTIVE,
    supabase_user_id: null,
    ...overrides,
  } as User;
}

function setup(env: Record<string, string | undefined> = {}) {
  const qb = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  const txManager = {
    query: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  const userRepo = { findOneBy: jest.fn().mockResolvedValue(makeUser()) };
  const dataSource = {
    manager: {},
    getRepository: jest.fn().mockReturnValue(userRepo),
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
      cb(txManager),
    ),
  };
  const authTokens = {
    create: jest.fn().mockResolvedValue({ token: RAW, expiresAt: new Date() }),
    consume: jest.fn().mockResolvedValue(USER_ID),
    peek: jest.fn().mockResolvedValue(USER_ID),
    ttlMinutes: jest.fn((type: string) =>
      type === 'password_reset' ? 60 : 1440,
    ),
  };
  const passwords = { hash: jest.fn().mockResolvedValue('$argon2id$new') };
  const refreshTokens = { revokeAllForUser: jest.fn().mockResolvedValue(3) };
  const email = { sendTransactional: jest.fn().mockResolvedValue(true) };
  const limiter = { tryConsume: jest.fn().mockResolvedValue(true) };
  const service = new EmailFlowsService(
    dataSource as never,
    authTokens as never,
    passwords as never,
    refreshTokens as never,
    email as never,
    limiter as never,
    fakeConfig({ APP_PUBLIC_URL: BASE, ...env }),
  );
  const findUsers = jest
    .spyOn(authUsers, 'findUsersByEmail')
    .mockResolvedValue([makeUser()]);
  const verified = jest
    .spyOn(verification, 'isEmailVerified')
    .mockResolvedValue(false);
  const logs = {
    warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
  };
  const sent = () =>
    email.sendTransactional.mock.calls.map(
      ([m]) => m as { kind: string; to: string; text: string; html: string },
    );
  return {
    service,
    dataSource,
    txManager,
    qb,
    userRepo,
    authTokens,
    passwords,
    refreshTokens,
    email,
    limiter,
    findUsers,
    verified,
    logs,
    sent,
  };
}

/** Nothing secret or personal in any log line. */
function expectCleanLogs(t: ReturnType<typeof setup>) {
  const logged = JSON.stringify([
    t.logs.warn.mock.calls,
    t.logs.error.mock.calls,
  ]).toLowerCase();
  expect(logged).not.toContain('ani@example.test');
  expect(logged).not.toContain(RAW.toLowerCase());
  expect(logged).not.toContain('app.example.test');
}

afterEach(() => jest.restoreAllMocks());

describe('EmailFlowsService registration hooks', () => {
  it('onRegistered: verification token + email with the link (in the background)', async () => {
    const t = setup();
    t.service.onRegistered(makeUser(), '203.0.113.7');
    await t.service.whenIdle();
    expect(t.limiter.tryConsume).toHaveBeenCalledWith(
      'verification',
      'ani@example.test',
    );
    expect(t.authTokens.create).toHaveBeenCalledWith(
      USER_ID,
      'email_verification',
      '203.0.113.7',
    );
    const [mail] = t.sent();
    expect(mail.kind).toBe('verification');
    expect(mail.to).toBe('Ani@Example.test');
    expect(mail.text).toContain(`${BASE}/verify-email?token=${RAW}`);
    expect(mail.text).toContain('24 jam');
    expectCleanLogs(t);
  });

  it('onRegistered over the per-address limit: no token, no email', async () => {
    const t = setup();
    t.limiter.tryConsume.mockResolvedValue(false);
    t.service.onRegistered(makeUser());
    await t.service.whenIdle();
    expect(t.authTokens.create).not.toHaveBeenCalled();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });

  it('onRegistered without APP_PUBLIC_URL: warning, no token, no email', async () => {
    const t = setup({ APP_PUBLIC_URL: '' });
    t.service.onRegistered(makeUser());
    await t.service.whenIdle();
    expect(t.authTokens.create).not.toHaveBeenCalled();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
    expect(t.logs.warn).toHaveBeenCalledWith(
      expect.stringContaining('APP_PUBLIC_URL'),
    );
  });

  it('onDuplicateRegistration: "akun sudah ada" to the stored address with a login link; no token', async () => {
    const t = setup();
    t.service.onDuplicateRegistration('  ANI@example.TEST ');
    await t.service.whenIdle();
    expect(t.findUsers).toHaveBeenCalledWith(
      t.dataSource.manager,
      'ani@example.test',
    );
    const [mail] = t.sent();
    expect(mail.kind).toBe('account_exists');
    expect(mail.to).toBe('Ani@Example.test');
    expect(mail.text).toContain(`${BASE}/login`);
    expect(mail.text).toContain('Lupa password');
    expect(t.authTokens.create).not.toHaveBeenCalled();
  });

  it('onDuplicateRegistration without APP_PUBLIC_URL still sends, without a link', async () => {
    const t = setup({ APP_PUBLIC_URL: undefined });
    t.service.onDuplicateRegistration('ani@example.test');
    await t.service.whenIdle();
    const [mail] = t.sent();
    expect(mail.text).not.toContain('http');
  });

  it.each([
    ['several case-variant accounts', 2],
    ['no account (lost race rolled back)', 0],
  ])('onDuplicateRegistration with %s: nothing', async (_label, count) => {
    const t = setup();
    t.findUsers.mockResolvedValue(
      Array.from({ length: count }, () => makeUser()),
    );
    t.service.onDuplicateRegistration('ani@example.test');
    await t.service.whenIdle();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });

  it('onDuplicateRegistration over the limit: no lookup, no email', async () => {
    const t = setup();
    t.limiter.tryConsume.mockResolvedValue(false);
    t.service.onDuplicateRegistration('ani@example.test');
    await t.service.whenIdle();
    expect(t.findUsers).not.toHaveBeenCalled();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });
});

describe('EmailFlowsService.requestVerification (resend)', () => {
  it('one unverified account: new token + email', async () => {
    const t = setup();
    t.service.requestVerification(' Ani@Example.TEST ', '203.0.113.8');
    await t.service.whenIdle();
    expect(t.limiter.tryConsume).toHaveBeenCalledWith(
      'verification',
      'ani@example.test',
    );
    expect(t.verified).toHaveBeenCalledWith(t.dataSource, USER_ID);
    expect(t.authTokens.create).toHaveBeenCalledWith(
      USER_ID,
      'email_verification',
      '203.0.113.8',
    );
    expect(t.sent()[0].kind).toBe('verification');
  });

  it('already verified: nothing', async () => {
    const t = setup();
    t.verified.mockResolvedValue(true);
    t.service.requestVerification('ani@example.test');
    await t.service.whenIdle();
    expect(t.authTokens.create).not.toHaveBeenCalled();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });

  it('unknown email: nothing', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    t.service.requestVerification('nobody@example.test');
    await t.service.whenIdle();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });

  it('several matches: nothing, warning without the email', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([makeUser(), makeUser({ id: 'other' })]);
    t.service.requestVerification('ani@example.test');
    await t.service.whenIdle();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
    expect(t.logs.warn).toHaveBeenCalledWith(
      'Resend verification refused: several users match one normalized email',
    );
    expectCleanLogs(t);
  });

  it('over the limit: no lookup', async () => {
    const t = setup();
    t.limiter.tryConsume.mockResolvedValue(false);
    t.service.requestVerification('ani@example.test');
    await t.service.whenIdle();
    expect(t.findUsers).not.toHaveBeenCalled();
  });
});

describe('EmailFlowsService.requestPasswordReset (forgot-password)', () => {
  it('one account (verified or not, any kind): reset token + email with the link', async () => {
    const t = setup();
    t.service.requestPasswordReset('ani@example.test', '203.0.113.9');
    await t.service.whenIdle();
    expect(t.limiter.tryConsume).toHaveBeenCalledWith(
      'password_reset',
      'ani@example.test',
    );
    expect(t.authTokens.create).toHaveBeenCalledWith(
      USER_ID,
      'password_reset',
      '203.0.113.9',
    );
    const [mail] = t.sent();
    expect(mail.kind).toBe('password_reset');
    expect(mail.text).toContain(`${BASE}/reset-password?token=${RAW}`);
    expect(mail.text).toContain('1 jam');
    expectCleanLogs(t);
  });

  it('unknown email: nothing', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    t.service.requestPasswordReset('nobody@example.test');
    await t.service.whenIdle();
    expect(t.authTokens.create).not.toHaveBeenCalled();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });

  it('several matches: nothing, warning without the email', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([makeUser(), makeUser({ id: 'other' })]);
    t.service.requestPasswordReset('ani@example.test');
    await t.service.whenIdle();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
    expect(t.logs.warn).toHaveBeenCalledWith(
      'Password reset refused: several users match one normalized email',
    );
    expectCleanLogs(t);
  });

  it('over the limit: no lookup, no email', async () => {
    const t = setup();
    t.limiter.tryConsume.mockResolvedValue(false);
    t.service.requestPasswordReset('ani@example.test');
    await t.service.whenIdle();
    expect(t.findUsers).not.toHaveBeenCalled();
  });

  it('without APP_PUBLIC_URL: no token, no email', async () => {
    const t = setup({ APP_PUBLIC_URL: 'not a url' });
    t.service.requestPasswordReset('ani@example.test');
    await t.service.whenIdle();
    expect(t.authTokens.create).not.toHaveBeenCalled();
  });

  it('a failing background task is logged with the error name only and never thrown', async () => {
    const t = setup();
    t.authTokens.create.mockRejectedValue(
      Object.assign(new Error('duplicate key ani@example.test'), {
        name: 'QueryFailedError',
      }),
    );
    expect(() =>
      t.service.requestPasswordReset('ani@example.test'),
    ).not.toThrow();
    await t.service.whenIdle();
    expect(t.logs.error).toHaveBeenCalledWith(
      'Background password-reset task failed (QueryFailedError)',
    );
    expectCleanLogs(t);
  });

  it('onModuleDestroy waits for queued tasks', async () => {
    const t = setup();
    let release!: () => void;
    t.limiter.tryConsume.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      }),
    );
    t.service.requestPasswordReset('ani@example.test');
    const destroyed = t.service.onModuleDestroy();
    release();
    await destroyed;
    expect(t.email.sendTransactional).toHaveBeenCalledTimes(1);
  });
});

describe('EmailFlowsService.verifyEmail', () => {
  it('consumes the token and sets user_credentials.email_verified_at in ONE transaction', async () => {
    const t = setup();
    await t.service.verifyEmail(RAW);
    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(t.authTokens.consume).toHaveBeenCalledWith(
      RAW,
      'email_verification',
      t.txManager,
    );
    const set = t.qb.set.mock.calls[0][0] as {
      email_verified_at: () => string;
    };
    expect(set.email_verified_at()).toBe('COALESCE(email_verified_at, now())');
    expect(t.qb.where).toHaveBeenCalledWith('user_id = :userId', {
      userId: USER_ID,
    });
    expect(t.txManager.query).not.toHaveBeenCalled();
  });

  it('account without credentials: records an email_verifications row instead', async () => {
    const t = setup();
    t.qb.execute.mockResolvedValue({ affected: 0 });
    await t.service.verifyEmail(RAW);
    const [sql, params] = t.txManager.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('INSERT INTO email_verifications');
    expect(sql).toContain("'email_link'");
    expect(sql).toContain('ON CONFLICT (user_id) DO NOTHING');
    expect(params).toEqual([USER_ID]);
  });

  it('invalid, used or expired token: 400 invalid_or_expired_token, nothing written', async () => {
    const t = setup();
    t.authTokens.consume.mockResolvedValue(null);
    await expect(t.service.verifyEmail(RAW)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(t.qb.execute).not.toHaveBeenCalled();
  });
});

describe('EmailFlowsService.resetPassword', () => {
  const NEW = 'a brand new passphrase';

  it('success: policy, peek, hash, then ONE transaction (consume, upsert credentials, revoke all) and the "changed" email', async () => {
    const t = setup();
    await t.service.resetPassword(RAW, NEW);
    expect(t.authTokens.peek).toHaveBeenCalledWith(RAW, 'password_reset');
    expect(t.passwords.hash).toHaveBeenCalledWith(NEW);
    expect(t.authTokens.consume).toHaveBeenCalledWith(
      RAW,
      'password_reset',
      t.txManager,
    );
    const [sql, params] = t.txManager.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('INSERT INTO user_credentials');
    expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE SET');
    expect(sql).toContain('failed_login_count = 0');
    expect(sql).toContain('locked_until = NULL');
    expect(sql).toContain(
      'email_verified_at = COALESCE(user_credentials.email_verified_at',
    );
    expect(params[0]).toBe(USER_ID);
    expect(params[1]).toBe('$argon2id$new');
    expect(params[2]).toBeInstanceOf(Date);
    expect(t.refreshTokens.revokeAllForUser).toHaveBeenCalledWith(
      USER_ID,
      PASSWORD_RESET_REVOKE_REASON,
      t.txManager,
    );
    await t.service.whenIdle();
    expect(t.sent().map((m) => m.kind)).toEqual(['password_changed']);
  });

  it('too short: 400 before the token is even looked at', async () => {
    const t = setup();
    await expect(t.service.resetPassword(RAW, 'short')).rejects.toThrow(
      'Password must be at least 8 characters long',
    );
    expect(t.authTokens.peek).not.toHaveBeenCalled();
  });

  it('invalid token: 400 invalid_or_expired_token, nothing hashed', async () => {
    const t = setup();
    t.authTokens.peek.mockResolvedValue(null);
    await expect(t.service.resetPassword(RAW, NEW)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(t.passwords.hash).not.toHaveBeenCalled();
  });

  it('user gone between peek and load: 400 invalid_or_expired_token', async () => {
    const t = setup();
    t.userRepo.findOneBy.mockResolvedValue(null);
    await expect(t.service.resetPassword(RAW, NEW)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
  });

  it('password equal to the email: 400 and the token stays usable (not consumed)', async () => {
    const t = setup();
    await expect(
      t.service.resetPassword(RAW, 'ani@example.test'),
    ).rejects.toThrow(BadRequestException);
    expect(t.authTokens.consume).not.toHaveBeenCalled();
  });

  it('lost the race (consumed in parallel): 400, no credential write, no email', async () => {
    const t = setup();
    t.authTokens.consume.mockResolvedValue(null);
    await expect(t.service.resetPassword(RAW, NEW)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(t.txManager.query).not.toHaveBeenCalled();
    expect(t.refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    await t.service.whenIdle();
    expect(t.email.sendTransactional).not.toHaveBeenCalled();
  });
});

describe('EmailFlowsService.notifyPasswordChanged', () => {
  it('sends "password Anda telah diubah" to the user', async () => {
    const t = setup();
    t.service.notifyPasswordChanged(makeUser());
    await t.service.whenIdle();
    const [mail] = t.sent();
    expect(mail.kind).toBe('password_changed');
    expect(mail.to).toBe('Ani@Example.test');
    expect(mail.text).toContain('baru saja diubah');
  });
});
