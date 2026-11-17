/**
 * Environment for the integration (test:int) and e2e (test:e2e) tests.
 *
 * Every value is FORCED (not defaulted): variables already in the shell and
 * values from .env.local / .env never reach the tests, because @nestjs/config
 * and dotenv do not override variables that are already set in process.env.
 * So the tests always use the local Docker test database
 * (docker-compose.dev.yml) and fake placeholders for every external service.
 */
export const TEST_DATABASE_NAME = 'nusantara_play_test';

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
};

export function applyTestEnv(): void {
  // DATABASE_URL would win over DATABASE_*; never let it leak into tests.
  delete process.env.DATABASE_URL;
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }
}
