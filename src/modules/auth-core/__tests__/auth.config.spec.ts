import {
  decodePemEnv,
  parseAppPublicUrl,
  parseAcceptSupabaseTokens,
  parseCookiePath,
  parseCookieSecure,
  parseOriginPatterns,
  readAuthConfig,
} from '../../../config/auth.config';
import { authEnv, testKeys } from './helpers';

describe('readAuthConfig (Phase 07)', () => {
  const read = (env: Record<string, string | undefined>) =>
    readAuthConfig((key) => env[key]);

  it('enables local auth when all key variables are set, with defaults', () => {
    const config = read(authEnv());
    expect(config.keys).not.toBeNull();
    expect(config.keys?.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(config.keys?.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(config.missing).toEqual([]);
    expect(config.accessTokenTtlSeconds).toBe(900);
    expect(config.refreshTokenTtlDays).toBe(30);
    expect(config.refreshReuseGraceSeconds).toBe(20);
    expect(config.acceptSupabaseTokens).toBe(true);
  });

  it.each([
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'JWT_KEY_ID',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
  ])('disables local auth when %s is missing or empty', (name) => {
    expect(read(authEnv({ [name]: undefined })).keys).toBeNull();
    const config = read(authEnv({ [name]: '  ' }));
    expect(config.keys).toBeNull();
    expect(config.missing).toEqual([name]);
  });

  it('parses TTLs and falls back to defaults for invalid values', () => {
    const config = read(
      authEnv({
        ACCESS_TOKEN_TTL_SECONDS: '60',
        REFRESH_TOKEN_TTL_DAYS: 'abc',
        REFRESH_REUSE_GRACE_SECONDS: '0',
      }),
    );
    expect(config.accessTokenTtlSeconds).toBe(60);
    expect(config.refreshTokenTtlDays).toBe(30);
    expect(config.refreshReuseGraceSeconds).toBe(0);
  });

  it('AUTH_ACCEPT_SUPABASE_TOKENS defaults to true; only explicit false values disable it', () => {
    expect(parseAcceptSupabaseTokens(undefined)).toBe(true);
    expect(parseAcceptSupabaseTokens('')).toBe(true);
    expect(parseAcceptSupabaseTokens('true')).toBe(true);
    for (const value of ['false', 'FALSE', '0', 'no', 'off']) {
      expect(parseAcceptSupabaseTokens(value)).toBe(false);
    }
  });

  it('decodes base64 PEM and also accepts a raw PEM', () => {
    const keys = testKeys();
    expect(decodePemEnv(keys.publicKeyBase64)).toBe(keys.publicKeyPem.trim());
    expect(decodePemEnv(keys.publicKeyPem)).toBe(keys.publicKeyPem.trim());
  });
});

describe('readAuthConfig: Phase 08 settings', () => {
  const read = (env: Record<string, string | undefined>) =>
    readAuthConfig((key) => env[key]);

  it('defaults: cookie path /backend-api/auth, not Secure outside production, 5 failures, 15 minutes, no patterns', () => {
    const config = read({});
    expect(config.cookiePath).toBe('/backend-api/auth');
    expect(config.cookieSecure).toBe(false);
    expect(config.loginMaxFailed).toBe(5);
    expect(config.loginLockMinutes).toBe(15);
    expect(config.frontendOriginPatterns).toEqual([]);
  });

  it('reads AUTH_COOKIE_PATH, LOGIN_MAX_FAILED, LOGIN_LOCK_MINUTES and FRONTEND_ORIGIN_PATTERNS', () => {
    const config = read({
      AUTH_COOKIE_PATH: ' /api/auth ',
      LOGIN_MAX_FAILED: '3',
      LOGIN_LOCK_MINUTES: '30',
      FRONTEND_ORIGIN_PATTERNS:
        'https://np-[a-z0-9-]+\\.vercel\\.app, ,https://x\\.test',
    });
    expect(config.cookiePath).toBe('/api/auth');
    expect(config.loginMaxFailed).toBe(3);
    expect(config.loginLockMinutes).toBe(30);
    expect(config.frontendOriginPatterns).toEqual([
      'https://np-[a-z0-9-]+\\.vercel\\.app',
      'https://x\\.test',
    ]);
  });

  it('invalid numbers and cookie paths fall back to the defaults', () => {
    expect(read({ LOGIN_MAX_FAILED: '0' }).loginMaxFailed).toBe(5);
    expect(read({ LOGIN_LOCK_MINUTES: 'abc' }).loginLockMinutes).toBe(15);
    expect(parseCookiePath('relative/path')).toBe('/backend-api/auth');
    expect(parseCookiePath('/a; Domain=evil')).toBe('/backend-api/auth');
    expect(parseCookiePath(undefined)).toBe('/backend-api/auth');
  });

  it('AUTH_COOKIE_SECURE: explicit values win, otherwise true only in production', () => {
    expect(parseCookieSecure(undefined, 'production')).toBe(true);
    expect(parseCookieSecure(undefined, 'development')).toBe(false);
    expect(parseCookieSecure('', 'test')).toBe(false);
    expect(parseCookieSecure('false', 'production')).toBe(false);
    expect(parseCookieSecure('true', 'development')).toBe(true);
    expect(parseCookieSecure('garbage', 'production')).toBe(true);
    expect(
      read({ NODE_ENV: 'production', AUTH_COOKIE_SECURE: '0' }).cookieSecure,
    ).toBe(false);
  });

  it('parseOriginPatterns splits on commas and drops empty entries', () => {
    expect(parseOriginPatterns(undefined)).toEqual([]);
    expect(parseOriginPatterns(' a , ,b ')).toEqual(['a', 'b']);
  });
});

describe('readAuthConfig: Phase 09 settings', () => {
  const read = (env: Record<string, string | undefined>) =>
    readAuthConfig((key) => env[key]);

  it('defaults: verification 24 hours, reset 60 minutes, no APP_PUBLIC_URL', () => {
    const config = read({});
    expect(config.emailVerificationTtlHours).toBe(24);
    expect(config.passwordResetTtlMinutes).toBe(60);
    expect(config.appPublicUrl).toBeNull();
  });

  it('reads EMAIL_VERIFICATION_TTL_HOURS, PASSWORD_RESET_TTL_MINUTES and APP_PUBLIC_URL', () => {
    const config = read({
      EMAIL_VERIFICATION_TTL_HOURS: '48',
      PASSWORD_RESET_TTL_MINUTES: '30',
      APP_PUBLIC_URL: 'https://nusantaralegacy.org/',
    });
    expect(config.emailVerificationTtlHours).toBe(48);
    expect(config.passwordResetTtlMinutes).toBe(30);
    expect(config.appPublicUrl).toBe('https://nusantaralegacy.org');
  });

  it('invalid TTLs fall back to the defaults', () => {
    const config = read({
      EMAIL_VERIFICATION_TTL_HOURS: '0',
      PASSWORD_RESET_TTL_MINUTES: 'soon',
    });
    expect(config.emailVerificationTtlHours).toBe(24);
    expect(config.passwordResetTtlMinutes).toBe(60);
  });

  it.each([
    ['http://localhost:3001', 'http://localhost:3001'],
    ['  https://nusantaralegacy.org//  ', 'https://nusantaralegacy.org'],
    ['https://example.test/app/', 'https://example.test/app'],
  ])('APP_PUBLIC_URL %j -> %j', (value, expected) => {
    expect(parseAppPublicUrl(value)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'nusantaralegacy.org',
    'javascript:alert(1)',
    'ftp://example.test',
    'https://example.test/?a=1',
    'https://example.test/#x',
    'https://user:pw@example.test',
  ])('APP_PUBLIC_URL %j is rejected (null)', (value) => {
    expect(parseAppPublicUrl(value)).toBeNull();
  });
});
