/**
 * Phase 15 unit tests of the pure rewards parts: rule constants, the level
 * curve, idempotency keys, grant planning (Points path, hold period), the
 * Paspor threshold and the reconciliation comparison.
 */
import { compareBalance } from '../reward-reconcile';
import {
  isPasporStampEarned,
  pasporStampThreshold,
  planGrant,
  pointsAvailableAt,
} from '../grant-plan';
import { levelForXp, xpForLevel } from '../level';
import {
  buildAdminAdjustKey,
  buildRewardKey,
  keyForCurrency,
} from '../reward-keys';
import {
  assertRuleIsSafe,
  BROWSER_ACTIVITY_TYPES,
  PASPOR_STAMP_MIN_PROT,
  parsePointsHoldDays,
  REWARD_RULES,
  RewardRule,
} from '../rewards.rules';

const USER = '11111111-1111-4111-8111-111111111111';
const PROT_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-19T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** Test-only rule that grants Points (no real rule does in Phase 15). */
const TEST_POINTS_RULE: RewardRule = {
  code: 'TEST_POINTS',
  xp: 5,
  points: 20,
  once: 'sourceId',
  browserTriggered: false,
  sourceType: 'test',
};

describe('reward rules (constants)', () => {
  it('match the Jelajah simulation numbers', () => {
    expect(REWARD_RULES.PROVINCE_ENTER).toMatchObject({ xp: 25, points: 0 });
    expect(REWARD_RULES.PROT_VIEW).toMatchObject({ xp: 10, points: 0 });
    expect(REWARD_RULES.PASPOR_STAMP).toMatchObject({ xp: 50, points: 0 });
    expect(PASPOR_STAMP_MIN_PROT).toBe(3);
  });

  it('once per province / per PROT', () => {
    expect(REWARD_RULES.PROVINCE_ENTER.once).toBe('provinsiKode');
    expect(REWARD_RULES.PROT_VIEW.once).toBe('sourceId');
    expect(REWARD_RULES.PASPOR_STAMP.once).toBe('provinsiKode');
  });

  it('browser actions never give Points: every browser-triggered rule has 0 points', () => {
    const browserRules = Object.values(REWARD_RULES).filter(
      (rule) => rule.browserTriggered,
    );
    expect(browserRules.map((r) => r.code).sort()).toEqual([
      'PASPOR_STAMP',
      'PROT_VIEW',
      'PROVINCE_ENTER',
    ]);
    for (const rule of Object.values(REWARD_RULES)) {
      expect(() => assertRuleIsSafe(rule)).not.toThrow();
      if (rule.browserTriggered) {
        expect(rule.points).toBe(0);
      }
    }
    // No rule of Phase 15 grants Points at all.
    expect(Object.values(REWARD_RULES).every((r) => r.points === 0)).toBe(true);
  });

  it('the activity endpoint accepts exactly PROVINCE_ENTER and PROT_VIEW', () => {
    expect([...BROWSER_ACTIVITY_TYPES]).toEqual([
      'PROVINCE_ENTER',
      'PROT_VIEW',
    ]);
  });

  it('assertRuleIsSafe refuses Points on a browser-triggered rule and malformed rules', () => {
    expect(() =>
      assertRuleIsSafe({ ...REWARD_RULES.PROT_VIEW, points: 1 }),
    ).toThrow(/never give Points/);
    expect(() =>
      assertRuleIsSafe({ ...REWARD_RULES.PROT_VIEW, xp: -1 }),
    ).toThrow();
    expect(() =>
      assertRuleIsSafe({ ...REWARD_RULES.PROT_VIEW, xp: 1.5 }),
    ).toThrow();
    expect(() =>
      assertRuleIsSafe({ ...REWARD_RULES.PROT_VIEW, xp: 0 }),
    ).toThrow(/grants nothing/);
    expect(() => assertRuleIsSafe(TEST_POINTS_RULE)).not.toThrow();
  });

  it('POINTS_HOLD_DAYS: default 7, integers 0..365, anything else -> 7', () => {
    expect(parsePointsHoldDays(undefined)).toBe(7);
    expect(parsePointsHoldDays('')).toBe(7);
    expect(parsePointsHoldDays('0')).toBe(0);
    expect(parsePointsHoldDays(' 14 ')).toBe(14);
    expect(parsePointsHoldDays('365')).toBe(365);
    expect(parsePointsHoldDays('366')).toBe(7);
    expect(parsePointsHoldDays('-1')).toBe(7);
    expect(parsePointsHoldDays('1.5')).toBe(7);
    expect(parsePointsHoldDays('abc')).toBe(7);
  });
});

describe('levelForXp / xpForLevel', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [599, 3],
    [600, 4],
  ])('%i XP -> level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('negative or invalid XP -> level 1', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it('xpForLevel follows 50 x (L - 1) x L', () => {
    expect([1, 2, 3, 4, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 4500]);
    expect(xpForLevel(0)).toBe(0);
  });

  it('is exact at every boundary up to level 2000', () => {
    for (let level = 1; level <= 2000; level += 1) {
      const start = xpForLevel(level);
      expect(levelForXp(start)).toBe(level);
      if (start > 0) {
        expect(levelForXp(start - 1)).toBe(level - 1);
      }
    }
  });
});

describe('idempotency keys', () => {
  it('{rule}:{userId}:{ref}', () => {
    expect(buildRewardKey('PROVINCE_ENTER', USER, '16')).toBe(
      `PROVINCE_ENTER:${USER}:16`,
    );
    expect(buildRewardKey('PROT_VIEW', USER, PROT_ID)).toBe(
      `PROT_VIEW:${USER}:${PROT_ID}`,
    );
  });

  it('refuses empty parts and parts containing ":"', () => {
    expect(() => buildRewardKey('PROT_VIEW', USER, '')).toThrow();
    expect(() => buildRewardKey('PROT_VIEW', '', PROT_ID)).toThrow();
    expect(() => buildRewardKey('PROT_VIEW', USER, 'a:b')).toThrow();
  });

  it('POINTS rows get a :POINTS suffix; admin keys are always new', () => {
    expect(keyForCurrency('K', 'XP')).toBe('K');
    expect(keyForCurrency('K', 'POINTS')).toBe('K:POINTS');
    const a = buildAdminAdjustKey(USER);
    expect(a).toMatch(new RegExp(`^ADMIN_ADJUST:${USER}:[0-9a-f-]{36}$`));
    expect(buildAdminAdjustKey(USER)).not.toBe(a);
  });
});

describe('planGrant', () => {
  const ctx = {
    userId: USER,
    emailVerified: false,
    now: NOW,
    pointsHoldDays: 7,
  };

  it('PROVINCE_ENTER: one XP row keyed by province', () => {
    const plan = planGrant(REWARD_RULES.PROVINCE_ENTER, {
      ...ctx,
      source: { id: '16', provinsiKode: '16' },
    });
    expect(plan.rows).toEqual([
      {
        currency: 'XP',
        amount: 25,
        idempotencyKey: `PROVINCE_ENTER:${USER}:16`,
        availableAt: null,
      },
    ]);
    expect(plan.pointsWithheld).toBe(0);
    expect(plan.candidateKeys).toEqual([
      `PROVINCE_ENTER:${USER}:16`,
      `PROVINCE_ENTER:${USER}:16:POINTS`,
    ]);
  });

  it('PROT_VIEW: keyed by the PROT id, not the province', () => {
    const plan = planGrant(REWARD_RULES.PROT_VIEW, {
      ...ctx,
      source: { id: PROT_ID, provinsiKode: '16' },
    });
    expect(plan.baseKey).toBe(`PROT_VIEW:${USER}:${PROT_ID}`);
    expect(plan.rows).toHaveLength(1);
  });

  it('missing reference -> error', () => {
    expect(() =>
      planGrant(REWARD_RULES.PROT_VIEW, {
        ...ctx,
        source: { provinsiKode: '16' },
      }),
    ).toThrow(/missing sourceId/);
  });

  it('Points + verified email: a POINTS row on hold for POINTS_HOLD_DAYS', () => {
    const plan = planGrant(TEST_POINTS_RULE, {
      ...ctx,
      emailVerified: true,
      source: { id: 'quiz-1' },
    });
    expect(plan.rows).toEqual([
      expect.objectContaining({ currency: 'XP', amount: 5, availableAt: null }),
      {
        currency: 'POINTS',
        amount: 20,
        idempotencyKey: `TEST_POINTS:${USER}:quiz-1:POINTS`,
        availableAt: new Date(NOW.getTime() + 7 * DAY),
      },
    ]);
    expect(plan.pointsWithheld).toBe(0);
  });

  it('Points + unverified email: only the XP part, Points withheld', () => {
    const plan = planGrant(TEST_POINTS_RULE, {
      ...ctx,
      emailVerified: false,
      source: { id: 'quiz-1' },
    });
    expect(plan.rows.map((r) => r.currency)).toEqual(['XP']);
    expect(plan.pointsWithheld).toBe(20);
  });

  it('hold period: 0 days = available at once', () => {
    expect(pointsAvailableAt(NOW, 0)).toEqual(NOW);
    expect(pointsAvailableAt(NOW, 14)).toEqual(
      new Date(NOW.getTime() + 14 * DAY),
    );
  });
});

describe('Paspor stamp threshold', () => {
  it.each([
    [0, null],
    [1, 1],
    [2, 2],
    [3, 3],
    [10, 3],
  ])('province with %i ARSIP_NASIONAL PROT -> threshold %p', (count, want) => {
    expect(pasporStampThreshold(count)).toBe(want);
  });

  it('earned only at the threshold', () => {
    // 1 PROT: one view is enough.
    expect(isPasporStampEarned(0, 1)).toBe(false);
    expect(isPasporStampEarned(1, 1)).toBe(true);
    // 2 PROT: both.
    expect(isPasporStampEarned(1, 2)).toBe(false);
    expect(isPasporStampEarned(2, 2)).toBe(true);
    // 3 PROT: all three.
    expect(isPasporStampEarned(2, 3)).toBe(false);
    expect(isPasporStampEarned(3, 3)).toBe(true);
    // 10 PROT: three are enough.
    expect(isPasporStampEarned(2, 10)).toBe(false);
    expect(isPasporStampEarned(3, 10)).toBe(true);
    // No PROT: never.
    expect(isPasporStampEarned(5, 0)).toBe(false);
  });
});

describe('compareBalance (reconciliation)', () => {
  const base = {
    user_id: USER,
    ledger_xp: 250,
    ledger_points: 20,
    ledger_points_available: 0,
    xp_total: 250,
    points_total: 20,
    points_available_cache: 0,
    level: 2,
  };

  it('matching balance -> nothing', () => {
    expect(compareBalance(base)).toEqual({
      differences: [],
      staleCache: false,
    });
  });

  it('reports xp, points and level differences', () => {
    const { differences } = compareBalance({
      ...base,
      xp_total: 300,
      points_total: 0,
      level: 3,
    });
    expect(differences).toEqual([
      { userId: USER, field: 'xp_total', expected: 250, actual: 300 },
      { userId: USER, field: 'points_total', expected: 20, actual: 0 },
      { userId: USER, field: 'level', expected: 2, actual: 3 },
    ]);
  });

  it('missing balance row with ledger rows -> difference; empty user -> nothing', () => {
    const missing = {
      ...base,
      xp_total: null,
      points_total: null,
      points_available_cache: null,
      level: null,
    };
    expect(compareBalance(missing).differences).toEqual([
      { userId: USER, field: 'balance_row', expected: 1, actual: null },
    ]);
    expect(
      compareBalance({ ...missing, ledger_xp: 0, ledger_points: 0 })
        .differences,
    ).toEqual([]);
  });

  it('a stale Points cache is not a difference', () => {
    const result = compareBalance({ ...base, ledger_points_available: 20 });
    expect(result).toEqual({ differences: [], staleCache: true });
  });
});
