/**
 * Jest globalSetup for test:int and test:e2e. Builds the schema and seeds
 * nusantara_play_test with the same logic as `npm run db:setup`
 * (src/scripts/db-local-setup.ts), including its guard: it refuses to run
 * unless the host is localhost/127.0.0.1 and the database name ends with
 * _test (enforced here) or _dev. Idempotent, so it runs before every test run.
 * Needs the local database container: npm run db:up
 */
import { setupLocalDatabase } from '../src/scripts/db-local-setup';
import { applyTestEnv, TEST_DATABASE_NAME } from './test-env';

export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  if (!process.env.DATABASE_NAME?.endsWith('_test')) {
    throw new Error('Test database name must end with _test.');
  }
  await setupLocalDatabase({
    database: TEST_DATABASE_NAME,
    demo: true,
    log: (message) => console.log(message),
  });
}
