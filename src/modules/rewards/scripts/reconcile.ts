/**
 * npm run rewards:reconcile            # report only (changes nothing)
 * npm run rewards:reconcile -- --fix   # also rewrite the differing balances
 *
 * Recomputes balances and levels from reward_ledger (reward-reconcile.ts).
 * Uses the same DATABASE_* variables and env files as the app (.env.local,
 * then .env). Prints user ids only, never other personal data.
 * Exit code: 0 = no difference (or fixed with --fix), 1 = differences found
 * without --fix, 2 = failure.
 */
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../../config/data-source-options';
import { reconcileRewardBalances } from '../reward-reconcile';

async function main(argv: string[]): Promise<number> {
  const unknown = argv.filter((arg) => arg !== '--fix');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(' ')}`);
  }
  const fix = argv.includes('--fix');
  const dataSource = new DataSource({
    ...buildDataSourceOptions((key) => process.env[key]),
    logging: false,
  });
  await dataSource.initialize();
  try {
    const report = await reconcileRewardBalances(dataSource, { fix });
    console.log(
      `[rewards:reconcile] ${report.usersChecked} users checked, ${report.differences.length} differences, ${report.staleCacheUsers} stale points_available_cache (not an error).`,
    );
    for (const d of report.differences) {
      console.log(
        `  user ${d.userId}: ${d.field} expected ${d.expected}, found ${d.actual ?? 'none'}`,
      );
    }
    if (fix) {
      console.log(
        `[rewards:reconcile] --fix: ${report.fixedUsers} balances rewritten from the ledger.`,
      );
      return 0;
    }
    if (report.differences.length > 0) {
      console.log(
        '[rewards:reconcile] Nothing changed. Run with -- --fix to repair.',
      );
      return 1;
    }
    return 0;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  // Same env files as the app and the migration CLI: .env.local, then .env.
  dotenv.config({ path: ['.env.local', '.env'], quiet: true });
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(
        `[rewards:reconcile] FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(2);
    });
}
