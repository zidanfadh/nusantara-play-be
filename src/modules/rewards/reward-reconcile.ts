/**
 * Reconciliation (Phase 15): recomputes every user's balance and level from
 * the append-only ledger and compares them with reward_balances.
 *
 * - Differences (xp_total, points_total, level, a missing balance row) are
 *   real errors: something changed a balance outside RewardsService.
 * - A stale points_available_cache is expected (Points leave their hold over
 *   time); it is reported separately and is not an error.
 *
 * Read-only unless `fix` is true. A fix takes the same per-user advisory lock
 * as RewardsService and writes the values recomputed under that lock.
 * CLI: npm run rewards:reconcile [-- --fix]  (scripts/reconcile.ts)
 */
import { DataSource, EntityManager } from 'typeorm';
import { levelForXp } from './level';

export type ReconcileField =
  | 'balance_row'
  | 'xp_total'
  | 'points_total'
  | 'level';

export interface ReconcileDifference {
  userId: string;
  field: ReconcileField;
  expected: number;
  actual: number | null;
}

export interface ReconcileReport {
  usersChecked: number;
  differences: ReconcileDifference[];
  staleCacheUsers: number;
  fixedUsers: number;
}

interface ComparisonRow {
  user_id: string;
  ledger_xp: number;
  ledger_points: number;
  ledger_points_available: number;
  xp_total: number | null;
  points_total: number | null;
  points_available_cache: number | null;
  level: number | null;
}

const COMPARISON_SQL = `
  WITH ledger AS (
    SELECT user_id,
           COALESCE(SUM(amount) FILTER (WHERE currency = 'XP'), 0)::int AS xp,
           COALESCE(SUM(amount) FILTER (WHERE currency = 'POINTS'), 0)::int AS points,
           COALESCE(SUM(amount) FILTER (WHERE currency = 'POINTS' AND available_at <= now()), 0)::int
             AS points_available
      FROM reward_ledger
     GROUP BY user_id
  )
  SELECT COALESCE(l.user_id, b.user_id) AS user_id,
         COALESCE(l.xp, 0) AS ledger_xp,
         COALESCE(l.points, 0) AS ledger_points,
         COALESCE(l.points_available, 0) AS ledger_points_available,
         b.xp_total, b.points_total, b.points_available_cache, b.level
    FROM ledger l
    FULL OUTER JOIN reward_balances b ON b.user_id = l.user_id
   ORDER BY 1`;

/** Pure comparison of one user's ledger sums with the stored balance. */
export function compareBalance(row: ComparisonRow): {
  differences: ReconcileDifference[];
  staleCache: boolean;
} {
  const differences: ReconcileDifference[] = [];
  const expectedLevel = levelForXp(row.ledger_xp);
  if (row.xp_total === null) {
    if (row.ledger_xp !== 0 || row.ledger_points !== 0) {
      differences.push({
        userId: row.user_id,
        field: 'balance_row',
        expected: 1,
        actual: null,
      });
    }
    return { differences, staleCache: false };
  }
  const checks: [ReconcileField, number, number | null][] = [
    ['xp_total', row.ledger_xp, row.xp_total],
    ['points_total', row.ledger_points, row.points_total],
    ['level', expectedLevel, row.level],
  ];
  for (const [field, expected, actual] of checks) {
    if (expected !== actual) {
      differences.push({ userId: row.user_id, field, expected, actual });
    }
  }
  return {
    differences,
    staleCache: row.points_available_cache !== row.ledger_points_available,
  };
}

export async function reconcileRewardBalances(
  dataSource: DataSource,
  options: { fix?: boolean } = {},
): Promise<ReconcileReport> {
  const rows = await dataSource.query<ComparisonRow[]>(COMPARISON_SQL);
  const differences: ReconcileDifference[] = [];
  const toFix = new Set<string>();
  let staleCacheUsers = 0;
  for (const row of rows) {
    const result = compareBalance(row);
    differences.push(...result.differences);
    if (result.staleCache) {
      staleCacheUsers += 1;
    }
    if (result.differences.length > 0 || result.staleCache) {
      toFix.add(row.user_id);
    }
  }
  let fixedUsers = 0;
  if (options.fix) {
    for (const userId of toFix) {
      await dataSource.transaction((manager) =>
        rebuildBalance(manager, userId),
      );
      fixedUsers += 1;
    }
  }
  return {
    usersChecked: rows.length,
    differences,
    staleCacheUsers,
    fixedUsers,
  };
}

/** Rewrites one balance row from the ledger, under the per-user lock. */
async function rebuildBalance(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtextextended('rewards:' || $1, 0))`,
    [userId],
  );
  const sums = await manager.query<
    { xp: number; points: number; points_available: number }[]
  >(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE currency = 'XP'), 0)::int AS xp,
            COALESCE(SUM(amount) FILTER (WHERE currency = 'POINTS'), 0)::int AS points,
            COALESCE(SUM(amount) FILTER (WHERE currency = 'POINTS' AND available_at <= now()), 0)::int
              AS points_available
       FROM reward_ledger WHERE user_id = $1`,
    [userId],
  );
  const { xp, points, points_available } = sums[0];
  await manager.query(
    `INSERT INTO reward_balances (user_id, xp_total, points_total, points_available_cache, level, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE
       SET xp_total = EXCLUDED.xp_total,
           points_total = EXCLUDED.points_total,
           points_available_cache = EXCLUDED.points_available_cache,
           level = EXCLUDED.level,
           updated_at = now()`,
    [userId, xp, points, points_available, levelForXp(xp)],
  );
}
