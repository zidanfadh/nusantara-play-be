/**
 * LocalAuthController (Phase 08): cookie handling around the service.
 * Status codes, guards and real cookies: test/auth-endpoints.e2e-spec.ts.
 */
import type { Request, Response } from 'express';
import { RefreshConflictError, RefreshTokenInvalidError } from '../auth-errors';
import { LOGGED_IN_COOKIE, REFRESH_COOKIE } from '../auth-cookies';
import { LocalAuthController } from '../local-auth.controller';
import { REGISTER_RESPONSE } from '../local-auth.service';

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
  const controller = new LocalAuthController(auth as never, limiter as never);
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
    res: res as typeof res & Response,
    req: req as unknown as Request,
  };
}

describe('LocalAuthController (Phase 08)', () => {
  it('register always answers with the generic body', async () => {
    const t = setup();
    await expect(
      t.controller.register({
        email: 'a@b.test',
        password: 'x',
        full_name: 'A',
      }),
    ).resolves.toBe(REGISTER_RESPONSE);
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
