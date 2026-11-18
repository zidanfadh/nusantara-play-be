/**
 * Phase 09 building blocks: EmailSendLimiter, AuthCleanupScheduler,
 * EmailFlowsController (+ AuthErrorFilter code), the email-verification
 * helpers and the LocalAuthService hooks that delegate to EmailFlowsService.
 */
import { Logger } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { User } from '../../users/entities/user.entity';
import { AuthCleanupScheduler } from '../auth-cleanup.scheduler';
import { AuthErrorFilter } from '../auth-error.filter';
import { InvalidOrExpiredTokenError } from '../auth-errors';
import { EmailFlowsController } from '../email-flows.controller';
import {
  FORGOT_PASSWORD_RESPONSE,
  RESEND_VERIFICATION_RESPONSE,
  RESET_PASSWORD_RESPONSE,
  VERIFY_EMAIL_RESPONSE,
} from '../email-flows.service';
import {
  EMAIL_SEND_LIMIT,
  EmailSendLimiter,
} from '../email-send-limiter.service';
import {
  attachAuthState,
  getAuthState,
  isEmailVerified,
  loadUserWithAuthState,
  resolveEmailVerified,
} from '../email-verification';
import { LocalAuthService } from '../local-auth.service';
import { fakeConfig } from './helpers';

const USER_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => jest.restoreAllMocks());

describe('EmailSendLimiter (Phase 09)', () => {
  it('3 per address and purpose per hour; purposes and addresses are separate', async () => {
    const storage = new ThrottlerStorageService();
    const limiter = new EmailSendLimiter(storage);
    try {
      const results: boolean[] = [];
      for (let i = 0; i < EMAIL_SEND_LIMIT + 2; i += 1) {
        results.push(await limiter.tryConsume('password_reset', 'a@x.test'));
      }
      expect(results).toEqual([true, true, true, false, false]);
      await expect(
        limiter.tryConsume('verification', 'a@x.test'),
      ).resolves.toBe(true);
      await expect(
        limiter.tryConsume('password_reset', 'b@x.test'),
      ).resolves.toBe(true);
    } finally {
      storage.onApplicationShutdown();
    }
  });

  it('keys hold a SHA-256 of the email, never the address', () => {
    const key = EmailSendLimiter.key('verification', 'a@x.test');
    expect(key).toMatch(/^auth-email:verification:[0-9a-f]{64}$/);
    expect(key).not.toContain('a@x.test');
  });
});

describe('AuthCleanupScheduler (Phase 09)', () => {
  function setup() {
    const refreshTokens = { cleanupExpired: jest.fn().mockResolvedValue(5) };
    const authTokens = { cleanup: jest.fn().mockResolvedValue(2) };
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const scheduler = new AuthCleanupScheduler(
      refreshTokens as never,
      authTokens as never,
    );
    return { scheduler, refreshTokens, authTokens, log, error };
  }

  it('runs both cleanups with the same time and logs only the counts', async () => {
    const t = setup();
    const now = new Date('2026-11-18T03:15:00Z');
    await expect(t.scheduler.run(now)).resolves.toEqual({
      refreshTokens: 5,
      authTokens: 2,
    });
    expect(t.refreshTokens.cleanupExpired).toHaveBeenCalledWith(now);
    expect(t.authTokens.cleanup).toHaveBeenCalledWith(now);
    expect(t.log).toHaveBeenCalledWith(
      'Auth cleanup: 5 refresh tokens, 2 email tokens deleted',
    );
  });

  it('one failing cleanup does not stop the other; the error name only is logged', async () => {
    const t = setup();
    t.refreshTokens.cleanupExpired.mockRejectedValue(
      Object.assign(new Error('connection to 10.0.0.1 lost'), {
        name: 'QueryFailedError',
      }),
    );
    await expect(t.scheduler.run()).resolves.toEqual({
      refreshTokens: null,
      authTokens: 2,
    });
    expect(t.error).toHaveBeenCalledWith(
      'Auth cleanup of refresh tokens failed (QueryFailedError)',
    );
    expect(t.log).toHaveBeenCalledWith(
      'Auth cleanup: failed refresh tokens, 2 email tokens deleted',
    );
  });
});

describe('EmailFlowsController (Phase 09)', () => {
  function setup() {
    const flows = {
      verifyEmail: jest.fn().mockResolvedValue(undefined),
      requestVerification: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new EmailFlowsController(flows as never);
    const req = { ip: '203.0.113.5' } as never;
    return { controller, flows, req };
  }

  it('verify-email and reset-password answer the generic bodies', async () => {
    const t = setup();
    await expect(t.controller.verifyEmail({ token: 'tok' })).resolves.toBe(
      VERIFY_EMAIL_RESPONSE,
    );
    expect(t.flows.verifyEmail).toHaveBeenCalledWith('tok');
    await expect(
      t.controller.resetPassword({ token: 'tok', newPassword: 'pw pw pw pw' }),
    ).resolves.toBe(RESET_PASSWORD_RESPONSE);
    expect(t.flows.resetPassword).toHaveBeenCalledWith('tok', 'pw pw pw pw');
  });

  it('resend-verification and forgot-password always answer the same body and pass the IP', () => {
    const t = setup();
    expect(
      t.controller.resendVerification({ email: 'a@x.test' }, t.req),
    ).toBe(RESEND_VERIFICATION_RESPONSE);
    expect(t.flows.requestVerification).toHaveBeenCalledWith(
      'a@x.test',
      '203.0.113.5',
    );
    expect(t.controller.forgotPassword({ email: 'a@x.test' }, t.req)).toBe(
      FORGOT_PASSWORD_RESPONSE,
    );
    expect(t.flows.requestPasswordReset).toHaveBeenCalledWith(
      'a@x.test',
      '203.0.113.5',
    );
  });

  it('AuthErrorFilter answers 400 with code invalid_or_expired_token', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/auth/verify-email', method: 'POST' }),
        getResponse: () => ({ status }),
      }),
    };
    new AuthErrorFilter().catch(
      new InvalidOrExpiredTokenError(),
      host as never,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'invalid_or_expired_token',
        message: 'The link is invalid or has expired',
        path: '/api/auth/verify-email',
      }),
    );
    expect(json.mock.calls[0][0]).not.toHaveProperty('error');
  });
});

describe('email-verification helpers (Phase 09)', () => {
  const user = { id: USER_ID, email: 'a@x.test' } as User;

  it('isEmailVerified: one query over user_credentials OR email_verifications', async () => {
    const db = { query: jest.fn().mockResolvedValue([{ verified: true }]) };
    await expect(isEmailVerified(db as never, USER_ID)).resolves.toBe(true);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('email_verified_at IS NOT NULL');
    expect(sql).toContain('FROM email_verifications');
    expect(params).toEqual([USER_ID]);
    db.query.mockResolvedValue([]);
    await expect(isEmailVerified(db as never, USER_ID)).resolves.toBe(false);
  });

  it('resolveEmailVerified uses the attached state without a query, else queries', async () => {
    const db = { query: jest.fn().mockResolvedValue([{ verified: false }]) };
    const withState = attachAuthState(
      { ...user },
      { emailVerified: true, passwordChangedAt: null },
    );
    await expect(resolveEmailVerified(db as never, withState)).resolves.toBe(
      true,
    );
    expect(db.query).not.toHaveBeenCalled();
    await expect(resolveEmailVerified(db as never, user)).resolves.toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('getAuthState is undefined for anything without a state; the state is not enumerable', () => {
    expect(getAuthState(null)).toBeUndefined();
    expect(getAuthState('x')).toBeUndefined();
    expect(getAuthState({ ...user })).toBeUndefined();
    const withState = attachAuthState(
      { ...user },
      { emailVerified: false, passwordChangedAt: null },
    );
    expect(Object.keys(withState)).toEqual(['id', 'email']);
    expect({ ...withState }).toEqual(user);
  });

  it('loadUserWithAuthState maps the raw columns (string dates too); null for an unknown id', async () => {
    const qb = {
      leftJoin: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [user],
        raw: [
          {
            auth_password_changed_at: '2026-11-18T10:00:00.000Z',
            auth_email_verified: true,
          },
        ],
      }),
    };
    qb.leftJoin.mockReturnValue(qb);
    qb.addSelect.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    const repo = { createQueryBuilder: () => qb };
    await expect(
      loadUserWithAuthState(repo as never, USER_ID),
    ).resolves.toEqual({
      user,
      state: {
        emailVerified: true,
        passwordChangedAt: new Date('2026-11-18T10:00:00.000Z'),
      },
    });
    expect(qb.leftJoin).toHaveBeenCalledTimes(2);
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    await expect(
      loadUserWithAuthState(repo as never, USER_ID),
    ).resolves.toBeNull();
  });
});

describe('LocalAuthService Phase 09 hooks', () => {
  function setup(withFlows = true) {
    const emailFlows = {
      onRegistered: jest.fn(),
      onDuplicateRegistration: jest.fn(),
      notifyPasswordChanged: jest.fn(),
    };
    const service = new LocalAuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      fakeConfig({}),
      withFlows ? (emailFlows as never) : undefined,
    );
    const hooks = service as unknown as {
      onRegistered: (
        id: string,
        email: string,
        name: string,
        ip: string | null,
      ) => void;
      onDuplicateRegistration: (email: string) => void;
    };
    return { hooks, emailFlows };
  }

  it('onRegistered / onDuplicateRegistration delegate to EmailFlowsService', () => {
    const t = setup();
    t.hooks.onRegistered(USER_ID, 'a@x.test', 'Ani', '203.0.113.1');
    expect(t.emailFlows.onRegistered).toHaveBeenCalledWith(
      { id: USER_ID, email: 'a@x.test', full_name: 'Ani' },
      '203.0.113.1',
    );
    t.hooks.onDuplicateRegistration('a@x.test');
    expect(t.emailFlows.onDuplicateRegistration).toHaveBeenCalledWith(
      'a@x.test',
    );
  });

  it('without EmailFlowsService (unit-test construction) the hooks are no-ops', () => {
    const t = setup(false);
    expect(() =>
      t.hooks.onRegistered(USER_ID, 'a@x.test', 'Ani', null),
    ).not.toThrow();
    expect(() => t.hooks.onDuplicateRegistration('a@x.test')).not.toThrow();
  });
});
