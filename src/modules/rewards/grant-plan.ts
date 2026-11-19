/**
 * Pure grant planning (Phase 15): which ledger rows a grant writes. No
 * database access, so every branch is unit-tested (grant-plan.spec.ts).
 */
import { RewardCurrency } from './entities/reward-ledger-entry.entity';
import { buildRewardKey, keyForCurrency } from './reward-keys';
import { PASPOR_STAMP_MIN_PROT, RewardRule } from './rewards.rules';

/** What a grant is about. Every value comes from the server, never the client. */
export interface RewardSource {
  /** e.g. the PROT id (PROT_VIEW) or the province code (PROVINCE_ENTER). */
  id?: string | null;
  provinsiKode?: string | null;
}

export interface PlannedLedgerRow {
  currency: RewardCurrency;
  amount: number;
  idempotencyKey: string;
  availableAt: Date | null;
}

export interface GrantPlan {
  baseKey: string;
  /** Every key this grant could write (duplicate detection). */
  candidateKeys: string[];
  rows: PlannedLedgerRow[];
  /** Points the rule would give but that are withheld (unverified email). */
  pointsWithheld: number;
}

export interface GrantPlanContext {
  userId: string;
  source: RewardSource;
  /** Only read when the rule grants Points. */
  emailVerified: boolean;
  /** Database clock at the start of the grant. */
  now: Date;
  pointsHoldDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function refForRule(rule: RewardRule, source: RewardSource): string {
  const value = rule.once === 'provinsiKode' ? source.provinsiKode : source.id;
  if (!value) {
    throw new Error(`Reward rule ${rule.code}: missing ${rule.once}.`);
  }
  return value;
}

export function planGrant(rule: RewardRule, ctx: GrantPlanContext): GrantPlan {
  const baseKey = buildRewardKey(
    rule.code,
    ctx.userId,
    refForRule(rule, ctx.source),
  );
  const rows: PlannedLedgerRow[] = [];
  if (rule.xp > 0) {
    rows.push({
      currency: 'XP',
      amount: rule.xp,
      idempotencyKey: keyForCurrency(baseKey, 'XP'),
      availableAt: null,
    });
  }
  let pointsWithheld = 0;
  if (rule.points > 0) {
    if (ctx.emailVerified) {
      rows.push({
        currency: 'POINTS',
        amount: rule.points,
        idempotencyKey: keyForCurrency(baseKey, 'POINTS'),
        availableAt: pointsAvailableAt(ctx.now, ctx.pointsHoldDays),
      });
    } else {
      pointsWithheld = rule.points;
    }
  }
  return {
    baseKey,
    candidateKeys: [
      keyForCurrency(baseKey, 'XP'),
      keyForCurrency(baseKey, 'POINTS'),
    ],
    rows,
    pointsWithheld,
  };
}

/** New Points become redeemable after the hold period. */
export function pointsAvailableAt(now: Date, holdDays: number): Date {
  return new Date(now.getTime() + holdDays * DAY_MS);
}

/**
 * PROT views a province needs for its Paspor stamp: min(3, its ARSIP_NASIONAL
 * PROT count), or null when it has none (no stamp possible).
 */
export function pasporStampThreshold(protCount: number): number | null {
  if (!Number.isInteger(protCount) || protCount < 1) {
    return null;
  }
  return Math.min(PASPOR_STAMP_MIN_PROT, protCount);
}

export function isPasporStampEarned(
  viewedCount: number,
  protCount: number,
): boolean {
  const threshold = pasporStampThreshold(protCount);
  return threshold !== null && viewedCount >= threshold;
}
