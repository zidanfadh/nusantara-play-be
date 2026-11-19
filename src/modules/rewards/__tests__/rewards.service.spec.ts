/**
 * Phase 15 unit tests of RewardsService with a fake database: validation of
 * activity types and reference ids, the grant transaction (lock first,
 * duplicates, the Points path with a test-only rule) and admin adjustments.
 * The real SQL runs in test/integration/rewards.int-spec.ts.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { REWARD_RULES, RewardRule } from '../rewards.rules';
import { RewardsService } from '../rewards.service';

const USER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const PROT_ID = '22222222-2222-4222-8222-222222222222';
const DB_NOW = new Date('2026-11-19T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const TEST_POINTS_RULE: RewardRule = {
  code: 'TEST_POINTS',
  xp: 5,
  points: 20,
  once: 'sourceId',
  browserTriggered: false,
  sourceType: 'test',
};

interface Call {
  sql: string;
  params: unknown[];
}

/** Minimal fake: routes SQL by pattern; records every call. */
class FakeDb {
  calls: Call[] = [];
  state = {
    provinces: ['16', '32'],
    publicProt: new Map<string, string | null>([[PROT_ID, '16']]),
    existingKeys: new Set<string>(),
    emailVerified: false,
    userExists: true,
    balance: null as null | {
      xp_total: number;
      points_total: number;
      level: number;
    },
  };

  query = jest.fn((sql: string, params: unknown[] = []) => {
    this.calls.push({ sql, params });
    return Promise.resolve(this.answer(sql, params));
  });

  transaction = jest.fn(
    (work: (manager: { query: FakeDb['query'] }) => Promise<unknown>) =>
      work({ query: this.query }),
  );

  sqlCalls(pattern: RegExp): Call[] {
    return this.calls.filter((c) => pattern.test(c.sql));
  }

  private answer(sql: string, params: unknown[]): unknown[] {
    const s = this.state;
    if (/FROM daerah/.test(sql)) {
      return s.provinces.includes(params[0] as string)
        ? [{ kode: params[0] }]
        : [];
    }
    if (/FROM prot WHERE id/.test(sql)) {
      const id = params[0] as string;
      return s.publicProt.has(id)
        ? [{ id, provinsiKode: s.publicProt.get(id) }]
        : [];
    }
    if (/SELECT now\(\)/.test(sql)) {
      return [{ now: DB_NOW }];
    }
    if (/AS verified/.test(sql)) {
      return [{ verified: s.emailVerified }];
    }
    if (/SELECT 1 FROM users/.test(sql)) {
      return s.userExists ? [{}] : [];
    }
    if (/FROM reward_balances b WHERE/.test(sql)) {
      return s.balance ? [{ ...s.balance, points_available: 0 }] : [];
    }
    if (/WHERE idempotency_key = ANY/.test(sql)) {
      const keys = params[0] as string[];
      return keys.some((k) => s.existingKeys.has(k)) ? [{}] : [];
    }
    if (/INSERT INTO reward_ledger/.test(sql)) {
      return [{ id: `row-${this.calls.length}` }];
    }
    if (/INSERT INTO reward_balances/.test(sql)) {
      return [{ xp_total: params[1] }];
    }
    if (/AS prot_count/.test(sql)) {
      return [{ prot_count: 4, viewed: 1, stamped: false }];
    }
    return [];
  }
}

function serviceWith(
  db: FakeDb,
  rules: Record<string, RewardRule> = REWARD_RULES,
  env: Record<string, string> = {},
): RewardsService {
  const config = { get: (key: string) => env[key] } as ConfigService;
  return new RewardsService(db as unknown as DataSource, config, rules);
}

describe('RewardsService', () => {
  let db: FakeDb;
  let service: RewardsService;

  beforeEach(() => {
    db = new FakeDb();
    service = serviceWith(db);
  });

  it('refuses to start with a browser-triggered rule that grants Points', () => {
    expect(() =>
      serviceWith(db, {
        ...REWARD_RULES,
        PROT_VIEW: { ...REWARD_RULES.PROT_VIEW, points: 5 },
      }),
    ).toThrow(/never give Points/);
  });

  describe('recordActivity: validation of types and reference ids', () => {
    it('unknown type -> 400 without touching the database', async () => {
      await expect(
        service.recordActivity(USER, 'QUIZ_PASSED', '16'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.calls).toHaveLength(0);
    });

    it.each(['1', '123', 'ab', '16 ', '1a', ''])(
      'PROVINCE_ENTER with malformed code %p -> 400 without a query',
      async (refId) => {
        await expect(
          service.recordActivity(USER, 'PROVINCE_ENTER', refId),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(db.calls).toHaveLength(0);
      },
    );

    it('PROVINCE_ENTER with a code that is not a province in daerah -> 400', async () => {
      await expect(
        service.recordActivity(USER, 'PROVINCE_ENTER', '99'),
      ).rejects.toThrow('Unknown province');
      expect(db.sqlCalls(/level = 'provinsi'/)).toHaveLength(1);
    });

    it('PROVINCE_ENTER with a valid province -> grant keyed by that province', async () => {
      const grant = jest.spyOn(service, 'grant');
      await service.recordActivity(USER, 'PROVINCE_ENTER', '16');
      expect(grant).toHaveBeenCalledWith(USER, 'PROVINCE_ENTER', {
        id: '16',
        provinsiKode: '16',
      });
    });

    it('PROT_VIEW with a non-uuid -> 400 without a query', async () => {
      await expect(
        service.recordActivity(USER, 'PROT_VIEW', 'not-a-uuid'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.calls).toHaveLength(0);
    });

    it('PROT_VIEW of a PROT that is unknown or not ARSIP_NASIONAL -> 400', async () => {
      await expect(
        service.recordActivity(
          USER,
          'PROT_VIEW',
          '44444444-4444-4444-8444-444444444444',
        ),
      ).rejects.toThrow('PROT not found or not public');
      expect(db.sqlCalls(/status = 'ARSIP_NASIONAL'/)).toHaveLength(1);
    });

    it('PROT_VIEW takes the province from the database', async () => {
      const grant = jest.spyOn(service, 'grant');
      await service.recordActivity(USER, 'PROT_VIEW', PROT_ID);
      expect(grant).toHaveBeenCalledWith(USER, 'PROT_VIEW', {
        id: PROT_ID,
        provinsiKode: '16',
      });
    });
  });

  describe('grant', () => {
    it('locks the user first, inserts the ledger row and updates the balance', async () => {
      const result = await service.grant(USER, 'PROVINCE_ENTER', {
        id: '16',
        provinsiKode: '16',
      });
      expect(db.calls[0].sql).toContain('pg_advisory_xact_lock');
      expect(db.calls[0].params).toEqual([USER]);
      const inserts = db.sqlCalls(/INSERT INTO reward_ledger/);
      expect(inserts).toHaveLength(1);
      expect(inserts[0].params.slice(0, 8)).toEqual([
        USER,
        'XP',
        25,
        'PROVINCE_ENTER',
        'province',
        '16',
        '16',
        `PROVINCE_ENTER:${USER}:16`,
      ]);
      expect(inserts[0].sql).toContain('ON CONFLICT (idempotency_key)');
      const upsert = db.sqlCalls(/INSERT INTO reward_balances/)[0];
      expect(upsert.sql).toContain(
        'xp_total = reward_balances.xp_total + EXCLUDED.xp_total',
      );
      expect(upsert.params).toEqual([USER, 25, 0]);
      expect(result).toMatchObject({
        granted: { xp: 25, points: 0 },
        duplicate: false,
        stamp: null,
      });
    });

    it('an existing key -> duplicate, nothing inserted, no error', async () => {
      db.state.existingKeys.add(`PROVINCE_ENTER:${USER}:16`);
      const result = await service.grant(USER, 'PROVINCE_ENTER', {
        id: '16',
        provinsiKode: '16',
      });
      expect(result.duplicate).toBe(true);
      expect(result.granted).toEqual({ xp: 0, points: 0 });
      expect(db.sqlCalls(/INSERT INTO reward_ledger/)).toHaveLength(0);
      expect(db.sqlCalls(/INSERT INTO reward_balances/)).toHaveLength(0);
    });

    it('PROT_VIEW records the view and checks the Paspor rule', async () => {
      await service.grant(USER, 'PROT_VIEW', {
        id: PROT_ID,
        provinsiKode: '16',
      });
      expect(db.sqlCalls(/INSERT INTO user_prot_views/)).toHaveLength(1);
      expect(db.sqlCalls(/AS prot_count/)).toHaveLength(1);
      // 1 of 4 viewed: no stamp yet.
      expect(db.sqlCalls(/INSERT INTO user_province_stamps/)).toHaveLength(0);
    });

    it('unknown rule -> error', async () => {
      await expect(service.grant(USER, 'NOPE', { id: 'x' })).rejects.toThrow(
        'Unknown reward rule',
      );
    });

    describe('Points path (test-only rule)', () => {
      beforeEach(() => {
        service = serviceWith(
          db,
          { ...REWARD_RULES, TEST_POINTS: TEST_POINTS_RULE },
          { POINTS_HOLD_DAYS: '10' },
        );
      });

      it('unverified email: XP only, Points withheld and noted', async () => {
        db.state.emailVerified = false;
        const result = await service.grant(USER, 'TEST_POINTS', {
          id: 'quiz-1',
        });
        const inserts = db.sqlCalls(/INSERT INTO reward_ledger/);
        expect(inserts.map((c) => c.params[1])).toEqual(['XP']);
        expect(JSON.parse(inserts[0].params[8] as string)).toEqual({
          points_withheld: 20,
          reason: 'email_not_verified',
        });
        expect(result.granted).toEqual({ xp: 5, points: 0 });
        expect(result.pointsWithheld).toBe(20);
      });

      it('verified email: a POINTS row available after POINTS_HOLD_DAYS', async () => {
        db.state.emailVerified = true;
        const result = await service.grant(USER, 'TEST_POINTS', {
          id: 'quiz-1',
        });
        const points = db
          .sqlCalls(/INSERT INTO reward_ledger/)
          .find((c) => c.params[1] === 'POINTS');
        expect(points?.params[2]).toBe(20);
        expect(points?.params[7]).toBe(`TEST_POINTS:${USER}:quiz-1:POINTS`);
        expect(points?.params[9]).toEqual(
          new Date(DB_NOW.getTime() + 10 * DAY),
        );
        expect(result.granted).toEqual({ xp: 5, points: 20 });
        expect(result.pointsWithheld).toBe(0);
      });

      it('the email check is skipped for XP-only rules', async () => {
        await service.grant(USER, 'PROVINCE_ENTER', {
          id: '16',
          provinsiKode: '16',
        });
        expect(db.sqlCalls(/AS verified/)).toHaveLength(0);
      });
    });
  });

  describe('adjust (admin)', () => {
    const input = {
      userId: USER,
      currency: 'XP' as const,
      amount: 40,
      reason: 'Koreksi manual',
    };

    it('inserts a compensating ADMIN_ADJUST row with the reason', async () => {
      const result = await service.adjust(ADMIN, input);
      const insert = db.sqlCalls(/INSERT INTO reward_ledger/)[0];
      expect(insert.params.slice(0, 7)).toEqual([
        USER,
        'XP',
        40,
        'ADMIN_ADJUST',
        'admin',
        ADMIN,
        null,
      ]);
      expect(insert.params[7]).toMatch(/^ADMIN_ADJUST:/);
      expect(JSON.parse(insert.params[8] as string)).toEqual({
        reason: 'Koreksi manual',
      });
      expect(result.id).toMatch(/^row-/);
      expect(result.granted).toEqual({ xp: 40, points: 0 });
      expect(db.calls[0].sql).toContain('pg_advisory_xact_lock');
    });

    it('unknown user -> 404', async () => {
      db.state.userExists = false;
      await expect(service.adjust(ADMIN, input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('never below 0', async () => {
      db.state.balance = { xp_total: 30, points_total: 0, level: 1 };
      await expect(
        service.adjust(ADMIN, { ...input, amount: -31 }),
      ).rejects.toThrow('below 0');
      await expect(
        service.adjust(ADMIN, { ...input, amount: -30 }),
      ).resolves.toMatchObject({ granted: { xp: -30, points: 0 } });
    });

    it('amount 0 or a fraction -> 400', async () => {
      await expect(
        service.adjust(ADMIN, { ...input, amount: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.adjust(ADMIN, { ...input, amount: 1.5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('positive Points need a verified email; removing Points does not', async () => {
      db.state.emailVerified = false;
      db.state.balance = { xp_total: 0, points_total: 50, level: 1 };
      await expect(
        service.adjust(ADMIN, { ...input, currency: 'POINTS', amount: 10 }),
      ).rejects.toMatchObject({
        response: { code: 'EMAIL_NOT_VERIFIED' },
      });
      await expect(
        service.adjust(ADMIN, { ...input, currency: 'POINTS', amount: -10 }),
      ).resolves.toMatchObject({ granted: { xp: 0, points: -10 } });
    });

    it('added Points are held, removed Points count at once', async () => {
      db.state.emailVerified = true;
      await service.adjust(ADMIN, {
        ...input,
        currency: 'POINTS',
        amount: 10,
      });
      const held = db.sqlCalls(/INSERT INTO reward_ledger/)[0];
      expect(held.params[9]).toEqual(new Date(DB_NOW.getTime() + 7 * DAY));

      db.calls = [];
      db.state.balance = { xp_total: 0, points_total: 10, level: 1 };
      await service.adjust(ADMIN, {
        ...input,
        currency: 'POINTS',
        amount: -10,
      });
      const removed = db.sqlCalls(/INSERT INTO reward_ledger/)[0];
      expect(removed.params[9]).toEqual(DB_NOW);
    });
  });
});
