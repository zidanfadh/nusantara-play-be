import type { Response } from 'express';
import {
  clearAuthCookies,
  LOGGED_IN_COOKIE,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from '../auth-cookies';

interface CookieCall {
  fn: 'cookie' | 'clear';
  name: string;
  value?: string;
  opts: Record<string, unknown>;
}

function fakeResponse() {
  const calls: CookieCall[] = [];
  const res = {
    cookie: (name: string, value: string, opts: Record<string, unknown>) =>
      calls.push({ fn: 'cookie', name, value, opts }),
    clearCookie: (name: string, opts: Record<string, unknown>) =>
      calls.push({ fn: 'clear', name, opts }),
  } as unknown as Response;
  const find = (name: string) => {
    const call = calls.find((c) => c.name === name);
    if (!call) {
      throw new Error(`no call for ${name}`);
    }
    return call;
  };
  return { res, find };
}

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const config = {
  cookiePath: '/backend-api/auth',
  cookieSecure: true,
  refreshTokenTtlDays: 30,
};

describe('auth cookies (Phase 08)', () => {
  it('np_refresh: httpOnly, Secure, SameSite=Lax, Path=AUTH_COOKIE_PATH, no Domain, Max-Age = TTL', () => {
    const { res, find } = fakeResponse();
    setAuthCookies(res, config, 'raw-token');
    const refresh = find(REFRESH_COOKIE);
    expect(refresh.value).toBe('raw-token');
    expect(refresh.opts).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/backend-api/auth',
      maxAge: DAYS_30_MS,
    });
  });

  it('np_logged_in=1: NOT httpOnly, Path=/, same lifetime and flags, no Domain', () => {
    const { res, find } = fakeResponse();
    setAuthCookies(res, { ...config, cookieSecure: false }, 'raw-token');
    const marker = find(LOGGED_IN_COOKIE);
    expect(marker.value).toBe('1');
    expect(marker.opts).toEqual({
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: DAYS_30_MS,
    });
  });

  it('clearing uses the same attributes (minus Max-Age)', () => {
    const set = fakeResponse();
    setAuthCookies(set.res, config, 'x');
    const cleared = fakeResponse();
    clearAuthCookies(cleared.res, config);
    for (const name of [REFRESH_COOKIE, LOGGED_IN_COOKIE]) {
      const { maxAge, ...attributes } = set.find(name).opts;
      expect(maxAge).toBe(DAYS_30_MS);
      expect(cleared.find(name).fn).toBe('clear');
      expect(cleared.find(name).opts).toEqual(attributes);
    }
  });

  it('readCookie: req.cookies first, else the Cookie header', () => {
    expect(
      readCookie({ headers: {}, cookies: { np_refresh: 'abc' } }, 'np_refresh'),
    ).toBe('abc');
    expect(
      readCookie({ headers: { cookie: 'x=1' }, cookies: {} }, 'np_refresh'),
    ).toBeNull();
    expect(
      readCookie(
        { headers: { cookie: 'a=1; np_refresh=t%2Bk; b=2' } },
        'np_refresh',
      ),
    ).toBe('t+k');
    expect(readCookie({ headers: {} }, 'np_refresh')).toBeNull();
    expect(
      readCookie({ headers: { cookie: 'np_refresh=%E0%A4%A' } }, 'np_refresh'),
    ).toBeNull();
  });
});
