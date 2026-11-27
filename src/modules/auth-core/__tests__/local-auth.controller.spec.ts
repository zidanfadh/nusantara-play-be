/**
 * LocalAuthController (Phase 08): cookie handling around the service.
 * Status codes, guards and real cookies: test/auth-endpoints.e2e-spec.ts.
 */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  LoginLockedError,
  RefreshConflictError,
  RefreshTokenInvalidError,
} from '../auth-errors';
import { LOGGED_IN_COOKIE, REFRESH_COOKIE } from '../auth-cookies';
import { LocalAuthController } from '../local-auth.controller';
import { REGISTER_RESPONSE } from '../local-auth.service';
import { LoginFailureTracker } from '../login-failure-tracker.service';

const config = {
  cookiePath: '/api/auth',
  cookieSecure: false,
  refreshTokenTtlDays: 30,
};

function setup() {
  const session = {
    accessToken: 'at',
    expiresIn: 900,
    user: { id: 'u1' },
    refreshToken: { token: 'new-refresh' },
  };
  const auth = {
    config,
    register: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(session),
    refresh: jest.fn().mockResolvedValue(session),
    logout: jest.fn().mockResolvedValue(undefined),
    logoutAll: jest.fn().mockResolvedValue(3),
  };
  const limiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const failures = new LoginFailureTracker();
  const controller = new LocalAuthController(
    auth as never,
    limiter as never,
    failures,
  );
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  const req = {
    headers: {},
    cookies: { [REFRESH_COOKIE]: 'old-refresh' },
    ip: '203.0.113.5',
    get: (name: string) => (name === 'user-agent' ? 'jest-ua' : undefined),
  };
  return {
    controller,
    auth,
    limiter,
    failures,
    res: res as typeof res & Response,
    req: req as unknown as Request,
  };
}

describe('LocalAuthController (Phase 08)', () => {
  it('register always answers with the generic body', async () => {
    const t = setup();
    await expect(
      t.controller.register(
        { email: 'a@b.test', password: 'x', full_name: 'A' },
        t.req as never,
      ),
    ).resolves.toBe(REGISTER_RESPONSE);
    // Phase 09: the client IP goes along (stored with the verification token).
    expect(t.auth.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.test' }),
      '203.0.113.5',
    );
  });

  it('login: per-email limit on the NORMALIZED email, then cookies + body without the refresh token', async () => {
    const t = setup();
    const body = await t.controller.login(
      { email: ' Ani@Example.TEST ', password: 'pw' },
      t.req,
      t.res,
    );
    expect(t.limiter.consume).toHaveBeenCalledWith('ani@example.test');
    expect(t.auth.login).toHaveBeenCalledWith(' Ani@Example.TEST ', 'pw', {
      userAgent: 'jest-ua',
      ip: '203.0.113.5',
    });
    expect(body).toEqual({
      accessToken: 'at',
      expiresIn: 900,
      user: { id: 'u1' },
    });
    expect(t.res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'new-refresh',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
    expect(t.res.cookie).toHaveBeenCalledWith(
      LOGGED_IN_COOKIE,
      '1',
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });

  it('login: a 429 from the limiter stops before the service', async () => {
    const t = setup();
    t.limiter.consume.mockRejectedValue(new Error('429'));
    await expect(
      t.controller.login({ email: 'a@b.test', password: 'pw' }, t.req, t.res),
    ).rejects.toThrow('429');
    expect(t.auth.login).not.toHaveBeenCalled();
  });

  it('login (Phase 29): generic 401s are counted per normalized email; the 5th answers 429 login_locked', async () => {
    const t = setup();
    t.auth.login.mockRejectedValue(
      new UnauthorizedException('Invalid email or password'),
    );
    const attempt = () =>
      t.controller.login(
        { email: ' Who@Example.TEST ', password: 'x' },
        t.req,
        t.res,
      );
    for (let i = 0; i < 4; i += 1) {
      await expect(attempt()).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const fifth = await attempt().catch((e: unknown) => e);
    expect(fifth).toBeInstanceOf(LoginLockedError);
    expect((fifth as LoginLockedError).retryAfterSeconds).toBe(900);
    // Locked: refused before the service (no password check), like the database lock.
    t.auth.login.mockClear();
    await expect(attempt()).rejects.toBeInstanceOf(LoginLockedError);
    expect(t.auth.login).not.toHaveBeenCalled();
    expect(t.failures.remainingSeconds('who@example.test')).toBeGreaterThan(0);
  });

  it('login (Phase 29): a success resets the count; 403 and other errors are not counted', async () => {
    const t = setup();
    t.auth.login.mockRejectedValue(new UnauthorizedException());
    for (let i = 0; i < 4; i += 1) {
      await t.controller
        .login({ email: 'a@b.test', password: 'x' }, t.req, t.res)
        .catch(() => {});
    }
    t.auth.login.mockResolvedValueOnce({
      accessToken: 'at',
      expiresIn: 900,
      user: { id: 'u1' },
      refreshToken: { token: 'r' },
    });
    await t.controller.login(
      { email: 'a@b.test', password: 'pw' },
      t.req,
      t.res,
    );
    t.auth.login.mockRejectedValue(
      new ForbiddenException('This account cannot sign in'),
    );
    for (let i = 0; i < 6; i += 1) {
      await expect(
        t.controller.login({ email: 'a@b.test', password: 'pw' }, t.req, t.res),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(t.failures.remainingSeconds('a@b.test')).toBe(0);
  });

  it('refresh: reads the cookie and sets the rotated one', async () => {
    const t = setup();
    await t.controller.refresh(t.req, t.res);
    expect(t.auth.refresh).toHaveBeenCalledWith('old-refresh', {
      userAgent: 'jest-ua',
      ip: '203.0.113.5',
    });
    expect(t.res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'new-refresh',
      expect.anything(),
    );
  });

  it('refresh: 401 clears BOTH cookies', async () => {
    const t = setup();
    t.auth.refresh.mockRejectedValue(
      new RefreshTokenInvalidError('reuse_detected'),
    );
    await expect(t.controller.refresh(t.req, t.res)).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
    expect(t.res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/auth' }),
    );
    expect(t.res.clearCookie).toHaveBeenCalledWith(
      LOGGED_IN_COOKIE,
      expect.objectContaining({ path: '/' }),
    );
  });

  it('refresh: 409 refresh_conflict does NOT clear the cookies', async () => {
    const t = setup();
    t.auth.refresh.mockRejectedValue(new RefreshConflictError());
    await expect(t.controller.refresh(t.req, t.res)).rejects.toBeInstanceOf(
      RefreshConflictError,
    );
    expect(t.res.clearCookie).not.toHaveBeenCalled();
    expect(t.res.cookie).not.toHaveBeenCalled();
  });

  it('logout and logout-all always clear both cookies', async () => {
    const t = setup();
    await t.controller.logout(t.req, t.res);
    expect(t.auth.logout).toHaveBeenCalledWith('old-refresh');
    await t.controller.logoutAll({ id: 'u1' } as never, t.res);
    expect(t.auth.logoutAll).toHaveBeenCalledWith('u1');
    expect(t.res.clearCookie).toHaveBeenCalledTimes(4);
  });
});
