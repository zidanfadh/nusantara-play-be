/**
 * Environment for the integration (test:int) and e2e (test:e2e) tests.
 *
 * Every value is FORCED (not defaulted): variables already in the shell and
 * values from .env.local / .env never reach the tests, because @nestjs/config
 * and dotenv do not override variables that are already set in process.env.
 * So the tests always use the local Docker test database
 * (docker-compose.dev.yml) and fake placeholders for every external service.
 */
import { generateAuthKeyPair } from '../src/modules/auth-core/key-pair.util';

export const TEST_DATABASE_NAME = 'nusantara_play_test';

/**
 * Self-hosted auth keys (Phase 07): a FRESH RS256 key pair per test process,
 * generated in memory and never written to disk or committed.
 */
const TEST_AUTH_KEYS = generateAuthKeyPair('test');
export const TEST_JWT_ISSUER = 'nusantara-play-test';
export const TEST_JWT_AUDIENCE = 'nusantara-play-test';
/** FRONTEND_ORIGIN_PATTERNS of the tests: a Vercel-preview-like origin. */
export const TEST_ORIGIN_PATTERN =
  'https://nusantara-play-fe-[a-z0-9-]+\\.vercel\\.app';

export const TEST_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'test',
  FRONTEND_URLS: 'http://localhost:3001',
  // Local Docker test database. "localdev" is a local-only password.
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'localdev',
  DATABASE_NAME: TEST_DATABASE_NAME,
  DATABASE_SSL: 'false',
  // Fake placeholders (.invalid never resolves).
  SUPABASE_URL: 'https://supabase-placeholder.invalid',
  SUPABASE_ANON_KEY: 'test-placeholder-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-placeholder-service-role-key',
  SUPABASE_JWT_SECRET: 'test-placeholder-jwt-secret',
  AWS_REGION: 'ap-southeast-1',
  AWS_ACCESS_KEY_ID: 'TESTPLACEHOLDERKEYID',
  AWS_SECRET_ACCESS_KEY: 'test-placeholder-secret-access-key',
  AWS_S3_BUCKET: 'test-placeholder-bucket',
  USER_CREDENTIAL_EMAIL_ENABLED: 'false',
  SMTP_HOST: 'smtp.placeholder.invalid',
  // Empty = BlockchainService stays inactive.
  BLOCKCHAIN_RPC_URL: '',
  BLOCKCHAIN_PRIVATE_KEY: '',
  BLOCKCHAIN_CONTRACT_ADDRESS: '',
  // Self-hosted auth (Phase 07): local auth enabled with the keys above,
  // legacy Supabase tokens accepted (the production default).
  JWT_PRIVATE_KEY: TEST_AUTH_KEYS.privateKeyBase64,
  JWT_PUBLIC_KEY: TEST_AUTH_KEYS.publicKeyBase64,
  JWT_KEY_ID: TEST_AUTH_KEYS.keyId,
  JWT_ISSUER: TEST_JWT_ISSUER,
  JWT_AUDIENCE: TEST_JWT_AUDIENCE,
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  REFRESH_REUSE_GRACE_SECONDS: '20',
  AUTH_ACCEPT_SUPABASE_TOKENS: 'true',
  // Phase 08: cookies and CSRF as in local development (the browser calls
  // http://localhost:3000/api directly), lockout defaults.
  AUTH_COOKIE_PATH: '/api/auth',
  AUTH_COOKIE_SECURE: '',
  FRONTEND_ORIGIN_PATTERNS: TEST_ORIGIN_PATTERN,
  LOGIN_MAX_FAILED: '5',
  LOGIN_LOCK_MINUTES: '15',
};

export function applyTestEnv(): void {
  // DATABASE_URL would win over DATABASE_*; never let it leak into tests.
  delete process.env.DATABASE_URL;
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }
}
