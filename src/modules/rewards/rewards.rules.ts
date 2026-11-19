/**
 * Reward rules (Phase 15). THE one place for reward numbers: change them here.
 *
 * Owner decisions:
 * - Two currencies. XP = levels and leaderboard, never redeemable. POINTS =
 *   redeemable later for in-platform rewards; never cashed out, never
 *   transferable.
 * - Actions reported by the browser give XP ONLY, never Points, because a
 *   script can fake them (rules with `browserTriggered: true`, checked by
 *   assertRuleIsSafe() and a unit test). Points will come only from
 *   server-verified actions (quizzes graded on the server, organizer-confirmed
 *   event check-ins, realtime-verified mini-games). In Phase 15 only
 *   ADMIN_ADJUST can change Points.
 * - Same numbers as the Jelajah simulation (frontend DEMO_REWARD_RULES).
 */

/** Which part of the source makes a rule "once per ...". */
export type RewardOnceKey = 'provinsiKode' | 'sourceId';

export interface RewardRule {
  code: string;
  /** XP granted (>= 0). */
  xp: number;
  /** POINTS granted (>= 0). Must be 0 for browser-triggered rules. */
  points: number;
  /** The idempotency key is {code}:{userId}:{value of this source field}. */
  once: RewardOnceKey;
  /** Triggered (directly or indirectly) by an action the browser reports. */
  browserTriggered: boolean;
  /** source_type written to the ledger. */
  sourceType: string;
}

export const REWARD_RULE_CODES = {
  provinceEnter: 'PROVINCE_ENTER',
  protView: 'PROT_VIEW',
  pasporStamp: 'PASPOR_STAMP',
  adminAdjust: 'ADMIN_ADJUST',
} as const;

export const REWARD_RULES: Readonly<Record<string, RewardRule>> = {
  /** Entering a province scene: once per province per user. */
  PROVINCE_ENTER: {
    code: 'PROVINCE_ENTER',
    xp: 25,
    points: 0,
    once: 'provinsiKode',
    browserTriggered: true,
    sourceType: 'province',
  },
  /** Opening a PROT (status ARSIP_NASIONAL only): once per PROT per user. */
  PROT_VIEW: {
    code: 'PROT_VIEW',
    xp: 10,
    points: 0,
    once: 'sourceId',
    browserTriggered: true,
    sourceType: 'prot',
  },
  /**
   * Paspor stamp of a province: granted by the server when the user has
   * viewed at least min(PASPOR_STAMP_MIN_PROT, the province's ARSIP_NASIONAL
   * PROT count) PROT there, and the province has at least 1 such PROT. Once
   * per province per user. Indirectly browser-triggered (by PROT_VIEW).
   */
  PASPOR_STAMP: {
    code: 'PASPOR_STAMP',
    xp: 50,
    points: 0,
    once: 'provinsiKode',
    browserTriggered: true,
    sourceType: 'province',
  },
};

/** Paspor: PROT views needed for a stamp (or all PROT, when fewer). */
export const PASPOR_STAMP_MIN_PROT = 3;

/** Activity types POST /api/rewards/activities accepts. Anything else: 400. */
export const BROWSER_ACTIVITY_TYPES = ['PROVINCE_ENTER', 'PROT_VIEW'] as const;
export type BrowserActivityType = (typeof BROWSER_ACTIVITY_TYPES)[number];

/** POST /api/rewards/activities: requests per minute per user. */
export const ACTIVITY_THROTTLE = { limit: 60, ttl: 60_000 };

/** Days new POINTS stay on hold (env POINTS_HOLD_DAYS overrides). */
export const POINTS_HOLD_DAYS_DEFAULT = 7;
export const POINTS_HOLD_DAYS_MAX = 365;

/** Admin adjustment limits (POST /api/admin/rewards/adjust). */
export const ADMIN_ADJUST_MAX_ABS_AMOUNT = 1_000_000;
export const ADMIN_ADJUST_REASON_MIN_LENGTH = 5;
export const ADMIN_ADJUST_REASON_MAX_LENGTH = 500;

/** Leaderboard: size and in-memory cache lifetime. */
export const LEADERBOARD_SIZE = 50;
export const LEADERBOARD_CACHE_MS = 60_000;

/** Ledger history page size. */
export const LEDGER_PAGE_LIMIT_DEFAULT = 20;
export const LEDGER_PAGE_LIMIT_MAX = 50;

/**
 * Throws when a rule is malformed or would let a browser-reported action
 * earn Points. RewardsService checks every rule before granting it.
 */
export function assertRuleIsSafe(rule: RewardRule): void {
  if (!Number.isInteger(rule.xp) || rule.xp < 0) {
    throw new Error(`Reward rule ${rule.code}: xp must be an integer >= 0.`);
  }
  if (!Number.isInteger(rule.points) || rule.points < 0) {
    throw new Error(
      `Reward rule ${rule.code}: points must be an integer >= 0.`,
    );
  }
  if (rule.browserTriggered && rule.points !== 0) {
    throw new Error(
      `Reward rule ${rule.code}: browser-triggered rules never give Points.`,
    );
  }
  if (rule.xp === 0 && rule.points === 0) {
    throw new Error(`Reward rule ${rule.code}: grants nothing.`);
  }
}

/** POINTS_HOLD_DAYS: integer 0..365; anything else -> the default (7). */
export function parsePointsHoldDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return POINTS_HOLD_DAYS_DEFAULT;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0 || value > POINTS_HOLD_DAYS_MAX) {
    return POINTS_HOLD_DAYS_DEFAULT;
  }
  return value;
}
