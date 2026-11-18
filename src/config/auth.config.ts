/**
 * Self-hosted auth configuration (Phase 07).
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
  };
}
