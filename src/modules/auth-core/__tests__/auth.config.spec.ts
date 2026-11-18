import {
  decodePemEnv,
  parseAcceptSupabaseTokens,
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
