/**
 * Self-hosted auth configuration (Phase 07; cookies, CSRF origins and
 * lockout since Phase 08; email link lifetimes and APP_PUBLIC_URL since
 * Phase 09).
 *
 * A pure parser over an env getter (same pattern as data-source-options.ts),
 * so the app (ConfigService), the guard and the tests read the same values.
 *
 * Local auth is ENABLED only when all five key/claim variables are present
 * and the keys parse. Otherwise `keys` is null, the app still boots, and
 * every token operation throws LocalAuthDisabledError (see TokenService).
 */
import type { EnvGetter } from './data-source-options';

export interface AuthKeyConfig {
  /** PEM text of the RS256 private key (PKCS#8). */
  privateKeyPem: string;
  /** PEM text of the matching public key (SPKI). */
  publicKeyPem: string;
  keyId: string;
  issuer: string;
  audience: string;
}

export interface AuthConfig {
  /** null = local auth disabled; `missing` lists the absent variable names. */
  keys: AuthKeyConfig | null;
  missing: string[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  refreshReuseGraceSeconds: number;
  acceptSupabaseTokens: boolean;
  /** Path attribute of the np_refresh cookie (Phase 08). */
  cookiePath: string;
  /** Secure attribute of both auth cookies (Phase 08). */
  cookieSecure: boolean;
  /**
   * Extra allowed Origins for the CSRF check, as anchored regular
   * expressions (FRONTEND_ORIGIN_PATTERNS, comma-separated; Phase 08).
   */
  frontendOriginPatterns: string[];
  /** Wrong passwords in a row before the account is locked (Phase 08). */
  loginMaxFailed: number;
  /** Lock duration after loginMaxFailed wrong passwords (Phase 08). */
  loginLockMinutes: number;
  /** Lifetime of an email verification token (Phase 09). */
  emailVerificationTtlHours: number;
  /** Lifetime of a password reset token (Phase 09). */
  passwordResetTtlMinutes: number;
  /**
   * Frontend base URL for links in emails, without a trailing slash
   * (APP_PUBLIC_URL; Phase 09). null = not set or not an http(s) URL: the
   * emails that need a link are not sent.
   */
  appPublicUrl: string | null;
}

export const AUTH_KEY_ENV_NAMES = [
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'JWT_KEY_ID',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
] as const;

export const AUTH_DEFAULTS = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
  refreshReuseGraceSeconds: 20,
  cookiePath: '/backend-api/auth',
  loginMaxFailed: 5,
  loginLockMinutes: 15,
  emailVerificationTtlHours: 24,
  passwordResetTtlMinutes: 60,
} as const;

/**
 * JWT_PRIVATE_KEY / JWT_PUBLIC_KEY hold the PEM base64-encoded (one line, no
 * newlines in .env). A raw PEM is accepted too, so a multi-line secret store
 * value also works.
 */
export function decodePemEnv(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  return Buffer.from(trimmed, 'base64').toString('utf8').trim();
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Default true; only an explicit false/0/no/off turns the legacy path off. */
export function parseAcceptSupabaseTokens(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') {
    return true;
  }
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

/**
 * AUTH_COOKIE_SECURE: explicit true/1/yes/on or false/0/no/off; anything
 * else (including unset) falls back to NODE_ENV === 'production'.
 */
export function parseCookieSecure(
  value: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return nodeEnv?.trim() === 'production';
}

/** AUTH_COOKIE_PATH must be an absolute path; otherwise the default. */
export function parseCookiePath(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed.startsWith('/') || /[;,\s]/.test(trimmed)) {
    return AUTH_DEFAULTS.cookiePath;
  }
  return trimmed;
}

/** Comma-separated list; empty entries dropped. Not compiled here. */
export function parseOriginPatterns(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

/**
 * APP_PUBLIC_URL: an absolute http(s) URL without query or fragment; the
 * trailing slash is removed. Anything else -> null.
 */
export function parseAppPublicUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    return null;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

export function readAuthConfig(getEnv: EnvGetter): AuthConfig {
  const missing = AUTH_KEY_ENV_NAMES.filter((name) => !getEnv(name)?.trim());
  const keys: AuthKeyConfig | null =
    missing.length === 0
      ? {
          privateKeyPem: decodePemEnv(getEnv('JWT_PRIVATE_KEY')!),
          publicKeyPem: decodePemEnv(getEnv('JWT_PUBLIC_KEY')!),
          keyId: getEnv('JWT_KEY_ID')!.trim(),
          issuer: getEnv('JWT_ISSUER')!.trim(),
          audience: getEnv('JWT_AUDIENCE')!.trim(),
        }
      : null;

  return {
    keys,
    missing: [...missing],
    accessTokenTtlSeconds: positiveInt(
      getEnv('ACCESS_TOKEN_TTL_SECONDS'),
      AUTH_DEFAULTS.accessTokenTtlSeconds,
    ),
    refreshTokenTtlDays: positiveInt(
      getEnv('REFRESH_TOKEN_TTL_DAYS'),
      AUTH_DEFAULTS.refreshTokenTtlDays,
    ),
    refreshReuseGraceSeconds: nonNegativeInt(
      getEnv('REFRESH_REUSE_GRACE_SECONDS'),
      AUTH_DEFAULTS.refreshReuseGraceSeconds,
    ),
    acceptSupabaseTokens: parseAcceptSupabaseTokens(
      getEnv('AUTH_ACCEPT_SUPABASE_TOKENS'),
    ),
    cookiePath: parseCookiePath(getEnv('AUTH_COOKIE_PATH')),
    cookieSecure: parseCookieSecure(
      getEnv('AUTH_COOKIE_SECURE'),
      getEnv('NODE_ENV'),
    ),
    frontendOriginPatterns: parseOriginPatterns(
      getEnv('FRONTEND_ORIGIN_PATTERNS'),
    ),
    loginMaxFailed: positiveInt(
      getEnv('LOGIN_MAX_FAILED'),
      AUTH_DEFAULTS.loginMaxFailed,
    ),
    loginLockMinutes: positiveInt(
      getEnv('LOGIN_LOCK_MINUTES'),
      AUTH_DEFAULTS.loginLockMinutes,
    ),
    emailVerificationTtlHours: positiveInt(
      getEnv('EMAIL_VERIFICATION_TTL_HOURS'),
      AUTH_DEFAULTS.emailVerificationTtlHours,
    ),
    passwordResetTtlMinutes: positiveInt(
      getEnv('PASSWORD_RESET_TTL_MINUTES'),
      AUTH_DEFAULTS.passwordResetTtlMinutes,
    ),
    appPublicUrl: parseAppPublicUrl(getEnv('APP_PUBLIC_URL')),
  };
}
