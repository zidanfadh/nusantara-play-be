/**
 * Phase 15 rewards against the real local test database: the append-only
 * trigger, idempotent grants, race safety under parallel load (advisory lock
 * per user), the Paspor stamp, the Points path with a test-only rule, and the
 * reconciliation.
 *
 * Province 76 (Sulawesi Barat) gets 20 test PROT; no DEMO PROT live there.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { levelForXp } from '../../src/modules/rewards/level';
import { reconcileRewardBalances } from '../../src/modules/rewards/reward-reconcile';
import { RewardsQueryService } from '../../src/modules/rewards/rewards-query.service';
import {
  REWARD_RULES,
  RewardRule,
} from '../../src/modules/rewards/rewards.rules';
import {
  REWARD_RULES_TOKEN,
  RewardsService,
} from '../../src/modules/rewards/rewards.service';
import { PROTStatus } from '../../src/modules/prot/entities/prot.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Fixtures } from './fixtures';

const PROVINCE = '76';
const PROT_COUNT = 20;

/** Test-only rule that grants Points (no real rule does in Phase 15). */
const TEST_POINTS_RULE: RewardRule = {
  code: 'TEST_POINTS',
  xp: 5,
  points: 20,
  once: 'sourceId',
  browserTriggered: false,
  sourceType: 'test',
};

describe('Rewards (integration, real database, Phase 15)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let rewards: RewardsService;
  let queries: RewardsQueryService;
  let fixtures: Fixtures;
  let protIds: string[];

  const ledgerOf = (userId: string) =>
    dataSource.query<
      { rule_code: string; currency: string; amount: number; id: string }[]
    >(
      'SELECT id, rule_code, currency, amount FROM reward_ledger WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
  const balanceOf = async (userId: string) =>
    (
      await dataSource.query<
        { xp_total: number; points_total: number; level: number }[]
      >(
        'SELECT xp_total, points_total, level FROM reward_balances WHERE user_id = $1',
        [userId],
      )
    )[0];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
      ],
      providers: [
        RewardsService,
        RewardsQueryService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ POINTS_HOLD_DAYS: '7' }),
        },
        {
          provide: REWARD_RULES_TOKEN,
          useValue: { ...REWARD_RULES, TEST_POINTS: TEST_POINTS_RULE },
        },
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
    rewards = moduleRef.get(RewardsService);
    queries = moduleRef.get(RewardsQueryService);
    fixtures = new Fixtures(dataSource);

    const owner = await fixtures.user();
    protIds = [];
    for (let i = 0; i < PROT_COUNT; i += 1) {
      const prot = await fixtures.prot(owner, PROTStatus.ARSIP_NASIONAL);
      await dataSource.query(
        'UPDATE prot SET "provinsiKode" = $1 WHERE id = $2',
        [PROVINCE, prot.id],
      );
      protIds.push(prot.id);
    }
  });

  afterAll(async () => {
    // Deleting the users cascades into the ledger (allowed by the trigger).
    await fixtures.cleanup();
    await moduleRef.close();
  });

  it('runs against the local test database with the ledger trigger installed', async () => {
    expect(process.env.DATABASE_NAME).toBe('nusantara_play_test');
    const triggers = await dataSource.query<{ tgname: string }[]>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'reward_ledger'::regclass AND NOT tgisinternal ORDER BY 1`,
    );
    expect(triggers.map((t) => t.tgname)).toEqual([
      'TRG_reward_ledger_append_only',
      'TRG_reward_ledger_no_truncate',
    ]);
  });

  it('the ledger trigger blocks UPDATE, DELETE and TRUNCATE', async () => {
    const user = await fixtures.user();
    await rewards.recordActivity(user.id, 'PROVINCE_ENTER', '16');
    const [row] = await ledgerOf(user.id);

    await expect(
      dataSource.query('UPDATE reward_ledger SET amount = 999 WHERE id = $1', [
        row.id,
      ]),
    ).rejects.toThrow(/append-only \(UPDATE refused\)/);
    await expect(
      dataSource.query('DELETE FROM reward_ledger WHERE id = $1', [row.id]),
    ).rejects.toThrow(/append-only \(DELETE refused\)/);
    await expect(
      dataSource.query('DELETE FROM reward_ledger WHERE user_id = $1', [
        user.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(dataSource.query('TRUNCATE reward_ledger')).rejects.toThrow(
      /append-only \(TRUNCATE refused\)/,
    );
    expect(await ledgerOf(user.id)).toEqual([
      expect.objectContaining({ amount: 25 }),
    ]);
  });

  it('deleting an account cascades through the ledger (the only allowed DELETE)', async () => {
    const user = await dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email: `int-rewards-del-${randomUUID().slice(0, 8)}@example.test`,
      full_name: 'INT rewards delete',
    });
    await rewards.recordActivity(user.id, 'PROT_VIEW', protIds[0]);
    expect(await ledgerOf(user.id)).toHaveLength(1);
    await dataSource.query('DELETE FROM users WHERE id = $1', [user.id]);
    expect(await ledgerOf(user.id)).toHaveLength(0);
    expect(await balanceOf(user.id)).toBeUndefined();
  });

  it('the same PROT_VIEW twice -> one row; the second call is a duplicate', async () => {
    const user = await fixtures.user();
    const first = await rewards.recordActivity(
      user.id,
      'PROT_VIEW',
      protIds[0],
    );
    const second = await rewards.recordActivity(
      user.id,
      'PROT_VIEW',
      protIds[0],
    );
    expect(first).toMatchObject({
      granted: { xp: 10, points: 0 },
      duplicate: false,
      balance: { xp: 10, points: 0 },
      level: 1,
    });
    expect(second).toMatchObject({
      granted: { xp: 0, points: 0 },
      duplicate: true,
      balance: { xp: 10 },
    });
    expect(await ledgerOf(user.id)).toHaveLength(1);
    const views = await dataSource.query<unknown[]>(
      'SELECT 1 FROM user_prot_views WHERE user_id = $1',
      [user.id],
    );
    expect(views).toHaveLength(1);
  });

  it('20 parallel PROT_VIEW of different PROT -> correct totals and exactly one PASPOR_STAMP', async () => {
    const user = await fixtures.user();
    const results = await Promise.all(
      protIds.map((id) => rewards.recordActivity(user.id, 'PROT_VIEW', id)),
    );

    const ledger = await ledgerOf(user.id);
    expect(ledger.filter((r) => r.rule_code === 'PROT_VIEW')).toHaveLength(20);
    expect(ledger.filter((r) => r.rule_code === 'PASPOR_STAMP')).toEqual([
      expect.objectContaining({ currency: 'XP', amount: 50 }),
    ]);
    const xp = 20 * 10 + 50;
    expect(await balanceOf(user.id)).toEqual({
      xp_total: xp,
      points_total: 0,
      level: levelForXp(xp),
    });
    // Exactly one call reports the stamp, and it was the third view.
    const stamped = results.filter((r) => r.stamp !== null);
    expect(stamped).toHaveLength(1);
    expect(stamped[0].stamp).toMatchObject({ provinsiKode: PROVINCE, xp: 50 });
    expect(stamped[0].granted.xp).toBe(60);
    expect(stamped[0].balance.xp).toBe(30 + 50);
    // Exactly one call crossed level 1 -> 2 (at 100 XP).
    expect(results.filter((r) => r.levelUp)).toHaveLength(1);
    const stamps = await dataSource.query<unknown[]>(
      'SELECT 1 FROM user_province_stamps WHERE user_id = $1',
      [user.id],
    );
    expect(stamps).toHaveLength(1);

    const paspor = await queries.getPaspor(user.id);
    expect(paspor.total_provinces).toBe(34);
    expect(paspor.provinces.find((p) => p.provinsi_kode === PROVINCE)).toEqual(
      expect.objectContaining({
        stamped: true,
        prot_viewed: 20,
        prot_count: expect.any(Number) as number,
      }),
    );
  });

  it('20 parallel PROVINCE_ENTER of the same province -> exactly one row', async () => {
    const user = await fixtures.user();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        rewards.recordActivity(user.id, 'PROVINCE_ENTER', PROVINCE),
      ),
    );
    expect(await ledgerOf(user.id)).toEqual([
      expect.objectContaining({ rule_code: 'PROVINCE_ENTER', amount: 25 }),
    ]);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(results.filter((r) => r.duplicate)).toHaveLength(19);
    expect((await balanceOf(user.id)).xp_total).toBe(25);
  });

  it('grants of different users do not block each other', async () => {
    const users = await Promise.all([fixtures.user(), fixtures.user()]);
    await Promise.all(
      users.flatMap((u) =>
        protIds
          .slice(0, 5)
          .map((id) => rewards.recordActivity(u.id, 'PROT_VIEW', id)),
      ),
    );
    for (const u of users) {
      expect((await balanceOf(u.id)).xp_total).toBe(5 * 10 + 50);
    }
  });

  it('a PROT that is not ARSIP_NASIONAL gives nothing', async () => {
    const user = await fixtures.user();
    const draft = await fixtures.prot(user, PROTStatus.DIVERIFIKASI);
    await expect(
      rewards.recordActivity(user.id, 'PROT_VIEW', draft.id),
    ).rejects.toThrow('PROT not found or not public');
    expect(await ledgerOf(user.id)).toHaveLength(0);
  });

  describe('Points path (test-only rule)', () => {
    it('unverified email: XP only; verified: Points on hold for 7 days', async () => {
      const user = await fixtures.user();
      const unverified = await rewards.grant(user.id, 'TEST_POINTS', {
        id: 'quiz-a',
      });
      expect(unverified).toMatchObject({
        granted: { xp: 5, points: 0 },
        pointsWithheld: 20,
      });

      await dataSource.query(
        `INSERT INTO email_verifications (user_id, method) VALUES ($1, 'email_link')`,
        [user.id],
      );
      const verified = await rewards.grant(user.id, 'TEST_POINTS', {
        id: 'quiz-b',
      });
      expect(verified).toMatchObject({
        granted: { xp: 5, points: 20 },
        balance: { xp: 10, points: 20, pointsAvailable: 0 },
      });
      const [row] = await dataSource.query<
        { available_at: Date; created_at: Date }[]
      >(
        `SELECT available_at, created_at FROM reward_ledger
          WHERE user_id = $1 AND currency = 'POINTS'`,
        [user.id],
      );
      const holdMs = row.available_at.getTime() - row.created_at.getTime();
      expect(Math.abs(holdMs - 7 * 24 * 3600 * 1000)).toBeLessThan(60_000);

      // A retry of the unverified grant stays a duplicate (no late Points).
      const retry = await rewards.grant(user.id, 'TEST_POINTS', {
        id: 'quiz-a',
      });
      expect(retry.duplicate).toBe(true);

      expect(await queries.getMe(user.id)).toEqual({
        xp: 10,
        level: 1,
        xpForCurrentLevel: 0,
        xpForNextLevel: 100,
        pointsTotal: 20,
        pointsAvailable: 0,
        pointsOnHold: 20,
      });
    });
  });

  describe('admin adjust', () => {
    it('compensating rows; never below 0', async () => {
      const [admin, user] = [await fixtures.user(), await fixtures.user()];
      await rewards.recordActivity(user.id, 'PROVINCE_ENTER', '16');
      const up = await rewards.adjust(admin.id, {
        userId: user.id,
        currency: 'XP',
        amount: 100,
        reason: 'Koreksi uji',
      });
      expect(up).toMatchObject({
        balance: { xp: 125 },
        level: 2,
        levelUp: true,
      });
      await expect(
        rewards.adjust(admin.id, {
          userId: user.id,
          currency: 'XP',
          amount: -126,
          reason: 'Koreksi uji',
        }),
      ).rejects.toThrow('below 0');
      const down = await rewards.adjust(admin.id, {
        userId: user.id,
        currency: 'XP',
        amount: -125,
        reason: 'Koreksi uji',
      });
      expect(down).toMatchObject({ balance: { xp: 0 }, level: 1 });
      expect(
        (await ledgerOf(user.id)).map((r) => [r.rule_code, r.amount]),
      ).toEqual([
        ['PROVINCE_ENTER', 25],
        ['ADMIN_ADJUST', 100],
        ['ADMIN_ADJUST', -125],
      ]);
    });
  });

  describe('reconciliation', () => {
    it('finds no difference after the runs above', async () => {
      const report = await reconcileRewardBalances(dataSource);
      expect(report.usersChecked).toBeGreaterThan(0);
      expect(report.differences).toEqual([]);
      expect(report.fixedUsers).toBe(0);
    });

    it('detects a manually broken balance, changes nothing without fix, repairs with fix', async () => {
      const user = await fixtures.user();
      await rewards.recordActivity(user.id, 'PROT_VIEW', protIds[1]);
      await dataSource.query(
        'UPDATE reward_balances SET xp_total = xp_total + 290 WHERE user_id = $1',
        [user.id],
      );

      const report = await reconcileRewardBalances(dataSource);
      expect(report.differences).toEqual([
        { userId: user.id, field: 'xp_total', expected: 10, actual: 300 },
      ]);
      expect((await balanceOf(user.id)).xp_total).toBe(300);

      // Level broken too.
      await dataSource.query(
        'UPDATE reward_balances SET level = 3 WHERE user_id = $1',
        [user.id],
      );
      const fixed = await reconcileRewardBalances(dataSource, { fix: true });
      expect(fixed.differences).toEqual(
        expect.arrayContaining([
          { userId: user.id, field: 'level', expected: 1, actual: 3 },
        ]),
      );
      expect(fixed.fixedUsers).toBeGreaterThanOrEqual(1);
      expect(await balanceOf(user.id)).toEqual({
        xp_total: 10,
        points_total: 0,
        level: 1,
      });
      expect((await reconcileRewardBalances(dataSource)).differences).toEqual(
        [],
      );
    });
  });
});
