import type { CookieOptions, Request, Response } from 'express';
import type { AuthConfig } from '../../config/auth.config';

/** httpOnly cookie with the raw refresh token (Phase 08). */
export const REFRESH_COOKIE = 'np_refresh';
/**
 * Readable marker cookie ("1"), no secret. The frontend middleware only uses
 * it to decide redirects; the backend never trusts it.
 */
export const LOGGED_IN_COOKIE = 'np_logged_in';

const DAY_MS = 24 * 60 * 60 * 1000;

type CookieConfig = Pick<
  AuthConfig,
  'cookiePath' | 'cookieSecure' | 'refreshTokenTtlDays'
>;

/**
 * Attributes shared by setting and clearing (browsers only delete a cookie
 * when name, Path and Domain match). Never a Domain attribute: host-only
 * cookies, so each frontend domain has its own session (owner decision).
 */
export function refreshCookieOptions(config: CookieConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: config.cookiePath,
  };
}

export function loggedInCookieOptions(config: CookieConfig): CookieOptions {
  return {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  config: CookieConfig,
  refreshToken: string,
): void {
  const maxAge = config.refreshTokenTtlDays * DAY_MS;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions(config),
    maxAge,
  });
  res.cookie(LOGGED_IN_COOKIE, '1', {
    ...loggedInCookieOptions(config),
    maxAge,
  });
}

export function clearAuthCookies(res: Response, config: CookieConfig): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(config));
  res.clearCookie(LOGGED_IN_COOKIE, loggedInCookieOptions(config));
}

/**
 * Reads a cookie: from cookie-parser's req.cookies (main.ts) or, if the
 * parser is not installed, straight from the Cookie header.
 */
export function readCookie(
  req: Pick<Request, 'headers'> & { cookies?: unknown },
  name: string,
): string | null {
  const parsed = req.cookies as Record<string, unknown> | undefined;
  if (parsed && typeof parsed === 'object') {
    const value = parsed[name];
    return typeof value === 'string' && value !== '' ? value : null;
  }
  const header = req.headers?.cookie;
  if (typeof header !== 'string') {
    return null;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      const raw = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(raw) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
