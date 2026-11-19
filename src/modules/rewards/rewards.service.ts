/**
 * RewardsService (Phase 15): the ONLY code that changes XP and Points.
 *
 * Every change is one transaction that
 * 1. takes pg_advisory_xact_lock on a hash of the user id (all grants of one
 *    user are serialized; different users run in parallel),
 * 2. builds the idempotency keys on the server (reward-keys.ts) and returns
 *    the current state without error when a key already exists (duplicate
 *    requests are normal),
 * 3. inserts append-only reward_ledger rows,
 * 4. updates reward_balances with atomic increments and the level
 *    (levelForXp) in the same transaction.
 *
 * Points need a verified email (otherwise only the XP part is granted) and
 * stay on hold for POINTS_HOLD_DAYS (default 7). No browser-triggered rule
 * may grant Points (assertRuleIsSafe).
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { isEmailVerified } from '../auth-core/email-verification';
import { RewardCurrency } from './entities/reward-ledger-entry.entity';
import {
  isPasporStampEarned,
  planGrant,
  pointsAvailableAt,
  RewardSource,
} from './grant-plan';
import { levelForXp } from './level';
import { buildAdminAdjustKey } from './reward-keys';
import {
  assertRuleIsSafe,
  parsePointsHoldDays,
  REWARD_RULE_CODES,
  RewardRule,
} from './rewards.rules';

/** Injection token of the rule set (tests may provide extra test-only rules). */
export const REWARD_RULES_TOKEN = Symbol('REWARD_RULES');

export interface RewardBalanceView {
  xp: number;
  points: number;
  pointsAvailable: number;
}

export interface StampResult {
  provinsiKode: string;
  xp: number;
  stampedAt: Date;
}

export interface GrantResult {
  /** What THIS call granted (a PROT_VIEW that earns a stamp includes the stamp XP). */
  granted: { xp: number; points: number };
  balance: RewardBalanceView;
  level: number;
  levelUp: boolean;
  /** The Paspor stamp this call earned, if any. */
  stamp: StampResult | null;
  /** True when the reward was already granted earlier (nothing new). */
  duplicate: boolean;
  /** Points the rule would give but that were withheld (email not verified). */
  pointsWithheld: number;
}

/** adjust() result; `id` = the new ledger row (AuditInterceptor stores it). */
export type AdminAdjustResult = GrantResult & { id: string };

export interface AdminAdjustInput {
  userId: string;
  currency: RewardCurrency;
  amount: number;
  reason: string;
}

interface RuleOutcome {
  xp: number;
  points: number;
  duplicate: boolean;
  pointsWithheld: number;
}

interface BalanceRow {
  xp_total: number;
  points_total: number;
  points_available: number;
  level: number;
}

const PROVINCE_KODE = /^\d{2}$/;

@Injectable()
export class RewardsService {
  private readonly pointsHoldDays: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
    @Inject(REWARD_RULES_TOKEN)
    private readonly rules: Readonly<Record<string, RewardRule>>,
  ) {
    this.pointsHoldDays = parsePointsHoldDays(
      config.get<string>('POINTS_HOLD_DAYS'),
    );
    Object.values(rules).forEach(assertRuleIsSafe);
  }

  /**
   * A browser-reported activity (POST /api/rewards/activities). Everything
   * except the type and the reference id comes from the database.
   */
  async recordActivity(
    userId: string,
    type: string,
    refId: string,
  ): Promise<GrantResult> {
    if (type === REWARD_RULE_CODES.provinceEnter) {
      const kode = await this.findProvinceKode(refId);
      return this.grant(userId, type, { id: kode, provinsiKode: kode });
    }
    if (type === REWARD_RULE_CODES.protView) {
      const prot = await this.findPublicProt(refId);
      return this.grant(userId, type, prot);
    }
    throw new BadRequestException('Unknown activity type');
  }

  /**
   * The single entry point for rule-based rewards. `source` must contain
   * server-side values only.
   */
  async grant(
    userId: string,
    ruleCode: string,
    source: RewardSource,
    opts: { metadata?: Record<string, unknown> } = {},
  ): Promise<GrantResult> {
    const rule = this.rules[ruleCode];
    if (!rule) {
      throw new Error(`Unknown reward rule: ${ruleCode}`);
    }
    assertRuleIsSafe(rule);
    return this.dataSource.transaction(async (manager) => {
      const now = await this.lockUser(manager, userId);
      const before = await this.readBalance(manager, userId);
      const outcome = await this.applyRule(
        manager,
        rule,
        userId,
        source,
        now,
        opts.metadata,
      );
      let stamp: StampResult | null = null;
      if (
        rule.code === REWARD_RULE_CODES.protView &&
        source.id &&
        source.provinsiKode
      ) {
        await manager.query(
          `INSERT INTO user_prot_views (user_id, prot_id, provinsi_kode, first_viewed_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, prot_id) DO NOTHING`,
          [userId, source.id, source.provinsiKode, now],
        );
        // Also on a duplicate view: a province whose PROT count dropped may
        // have become complete.
        stamp = await this.checkPasporStamp(
          manager,
          userId,
          source.provinsiKode,
          now,
        );
      }
      const after = await this.readBalance(manager, userId);
      return {
        granted: {
          xp: outcome.xp + (stamp?.xp ?? 0),
          points: outcome.points,
        },
        balance: toBalanceView(after),
        level: after.level,
        levelUp: after.level > before.level,
        stamp,
        duplicate: outcome.duplicate,
        pointsWithheld: outcome.pointsWithheld,
      };
    });
  }

  /**
   * Admin correction (POST /api/admin/rewards/adjust): a new compensating
   * ADMIN_ADJUST row; the ledger is never edited. Refuses a result below 0
   * and positive Points for a user without a verified email.
   */
  async adjust(
    adminId: string,
    input: AdminAdjustInput,
  ): Promise<AdminAdjustResult> {
    if (!Number.isInteger(input.amount) || input.amount === 0) {
      throw new BadRequestException('amount must be a non-zero integer');
    }
    return this.dataSource.transaction(async (manager) => {
      const now = await this.lockUser(manager, input.userId);
      const users = await manager.query<unknown[]>(
        'SELECT 1 FROM users WHERE id = $1',
        [input.userId],
      );
      if (users.length === 0) {
        throw new NotFoundException('User not found');
      }
      const isPoints = input.currency === 'POINTS';
      if (
        isPoints &&
        input.amount > 0 &&
        !(await isEmailVerified(manager, input.userId))
      ) {
        throw new BadRequestException({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Points need a verified email.',
        });
      }
      const before = await this.readBalance(manager, input.userId);
      const current = isPoints ? before.points_total : before.xp_total;
      if (current + input.amount < 0) {
        throw new BadRequestException(
          `The ${input.currency} balance would go below 0.`,
        );
      }
      const id = await this.insertRow(manager, {
        userId: input.userId,
        currency: input.currency,
        amount: input.amount,
        ruleCode: REWARD_RULE_CODES.adminAdjust,
        sourceType: 'admin',
        sourceId: adminId,
        provinsiKode: null,
        key: buildAdminAdjustKey(input.userId),
        metadata: { reason: input.reason },
        // Added Points are held like any Points; removed Points count at once.
        availableAt: isPoints
          ? input.amount > 0
            ? pointsAvailableAt(now, this.pointsHoldDays)
            : now
          : null,
        createdAt: now,
      });
      await this.applyDeltas(
        manager,
        input.userId,
        isPoints ? 0 : input.amount,
        isPoints ? input.amount : 0,
      );
      const after = await this.readBalance(manager, input.userId);
      if (id === null) {
        throw new Error('ADMIN_ADJUST key collision');
      }
      return {
        id,
        granted: {
          xp: isPoints ? 0 : input.amount,
          points: isPoints ? input.amount : 0,
        },
        balance: toBalanceView(after),
        level: after.level,
        levelUp: after.level > before.level,
        stamp: null,
        duplicate: false,
        pointsWithheld: 0,
      };
    });
  }

  /** Serializes all reward writes of one user; returns the database clock. */
  private async lockUser(
    manager: EntityManager,
    userId: string,
  ): Promise<Date> {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('rewards:' || $1, 0))`,
      [userId],
    );
    const rows = await manager.query<{ now: Date }[]>('SELECT now() AS now');
    return new Date(rows[0].now);
  }

  private async applyRule(
    manager: EntityManager,
    rule: RewardRule,
    userId: string,
    source: RewardSource,
    now: Date,
    metadata: Record<string, unknown> | undefined,
  ): Promise<RuleOutcome> {
    const emailVerified =
      rule.points > 0 ? await isEmailVerified(manager, userId) : false;
    const plan = planGrant(rule, {
      userId,
      source,
      emailVerified,
      now,
      pointsHoldDays: this.pointsHoldDays,
    });
    const existing = await manager.query<unknown[]>(
      'SELECT 1 FROM reward_ledger WHERE idempotency_key = ANY($1::text[]) LIMIT 1',
      [plan.candidateKeys],
    );
    if (existing.length > 0) {
      return { xp: 0, points: 0, duplicate: true, pointsWithheld: 0 };
    }
    let xp = 0;
    let points = 0;
    for (const row of plan.rows) {
      const inserted = await this.insertRow(manager, {
        userId,
        currency: row.currency,
        amount: row.amount,
        ruleCode: rule.code,
        sourceType: rule.sourceType,
        sourceId: source.id ?? null,
        provinsiKode: source.provinsiKode ?? null,
        key: row.idempotencyKey,
        metadata:
          row.currency === 'XP' && plan.pointsWithheld > 0
            ? {
                ...metadata,
                points_withheld: plan.pointsWithheld,
                reason: 'email_not_verified',
              }
            : (metadata ?? null),
        availableAt: row.availableAt,
        createdAt: now,
      });
      if (inserted !== null) {
        if (row.currency === 'XP') {
          xp += row.amount;
        } else {
          points += row.amount;
        }
      }
    }
    if (xp === 0 && points === 0 && plan.rows.length > 0) {
      // Every insert hit the unique key: someone else wrote it first.
      return { xp: 0, points: 0, duplicate: true, pointsWithheld: 0 };
    }
    if (xp !== 0 || points !== 0) {
      await this.applyDeltas(manager, userId, xp, points);
    }
    return {
      xp,
      points,
      duplicate: false,
      pointsWithheld: plan.pointsWithheld,
    };
  }

  private async insertRow(
    manager: EntityManager,
    row: {
      userId: string;
      currency: RewardCurrency;
      amount: number;
      ruleCode: string;
      sourceType: string;
      sourceId: string | null;
      provinsiKode: string | null;
      key: string;
      metadata: Record<string, unknown> | null;
      availableAt: Date | null;
      createdAt: Date;
    },
  ): Promise<string | null> {
    // created_at = clock_timestamp(): rows of one transaction keep their order.
    const inserted = await manager.query<{ id: string }[]>(
      `INSERT INTO reward_ledger
         (user_id, currency, amount, rule_code, source_type, source_id,
          provinsi_kode, idempotency_key, metadata, available_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, clock_timestamp())
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        row.userId,
        row.currency,
        row.amount,
        row.ruleCode,
        row.sourceType,
        row.sourceId,
        row.provinsiKode,
        row.key,
        row.metadata === null ? null : JSON.stringify(row.metadata),
        row.availableAt,
      ],
    );
    return inserted[0]?.id ?? null;
  }

  /** Atomic increments, then level and the Points cache, same transaction. */
  private async applyDeltas(
    manager: EntityManager,
    userId: string,
    xpDelta: number,
    pointsDelta: number,
  ): Promise<void> {
    const rows = await manager.query<{ xp_total: number }[]>(
      `INSERT INTO reward_balances (user_id, xp_total, points_total, points_available_cache, level, updated_at)
       VALUES ($1, $2, $3, 0, 1, now())
       ON CONFLICT (user_id) DO UPDATE
         SET xp_total = reward_balances.xp_total + EXCLUDED.xp_total,
             points_total = reward_balances.points_total + EXCLUDED.points_total,
             updated_at = now()
       RETURNING xp_total`,
      [userId, xpDelta, pointsDelta],
    );
    await manager.query(
      `UPDATE reward_balances
         SET level = $2,
             points_available_cache = (
               SELECT COALESCE(SUM(amount), 0)::int FROM reward_ledger
                WHERE user_id = $1 AND currency = 'POINTS' AND available_at <= now())
       WHERE user_id = $1`,
      [userId, levelForXp(rows[0].xp_total)],
    );
  }

  private async readBalance(
    manager: EntityManager,
    userId: string,
  ): Promise<BalanceRow> {
    const rows = await manager.query<BalanceRow[]>(
      `SELECT b.xp_total, b.points_total, b.level,
              (SELECT COALESCE(SUM(amount), 0)::int FROM reward_ledger
                WHERE user_id = $1 AND currency = 'POINTS' AND available_at <= now()) AS points_available
         FROM reward_balances b WHERE b.user_id = $1`,
      [userId],
    );
    return (
      rows[0] ?? { xp_total: 0, points_total: 0, points_available: 0, level: 1 }
    );
  }

  /** Grants PASPOR_STAMP once the province's view threshold is reached. */
  private async checkPasporStamp(
    manager: EntityManager,
    userId: string,
    provinsiKode: string,
    now: Date,
  ): Promise<StampResult | null> {
    const rows = await manager.query<
      { prot_count: number; viewed: number; stamped: boolean }[]
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM prot p
           WHERE p."provinsiKode" = $2 AND p.status = 'ARSIP_NASIONAL') AS prot_count,
         (SELECT COUNT(*)::int FROM user_prot_views v
            JOIN prot p ON p.id = v.prot_id AND p.status = 'ARSIP_NASIONAL'
                       AND p."provinsiKode" = v.provinsi_kode
           WHERE v.user_id = $1 AND v.provinsi_kode = $2) AS viewed,
         EXISTS (SELECT 1 FROM user_province_stamps s
                  WHERE s.user_id = $1 AND s.provinsi_kode = $2) AS stamped`,
      [userId, provinsiKode],
    );
    const { prot_count, viewed, stamped } = rows[0];
    if (stamped || !isPasporStampEarned(viewed, prot_count)) {
      return null;
    }
    const inserted = await manager.query<{ stamped_at: Date }[]>(
      `INSERT INTO user_province_stamps (user_id, provinsi_kode, stamped_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, provinsi_kode) DO NOTHING
       RETURNING stamped_at`,
      [userId, provinsiKode, now],
    );
    if (inserted.length === 0) {
      return null;
    }
    const rule = this.rules[REWARD_RULE_CODES.pasporStamp];
    const outcome = await this.applyRule(
      manager,
      rule,
      userId,
      { id: provinsiKode, provinsiKode },
      now,
      undefined,
    );
    return {
      provinsiKode,
      xp: outcome.xp,
      stampedAt: new Date(inserted[0].stamped_at),
    };
  }

  private async findProvinceKode(refId: string): Promise<string> {
    if (typeof refId !== 'string' || !PROVINCE_KODE.test(refId)) {
      throw new BadRequestException('Unknown province');
    }
    const rows = await this.dataSource.query<{ kode: string }[]>(
      `SELECT kode FROM daerah WHERE kode = $1 AND level = 'provinsi'`,
      [refId],
    );
    if (rows.length === 0) {
      throw new BadRequestException('Unknown province');
    }
    return rows[0].kode;
  }

  /** A PROT with status ARSIP_NASIONAL; its province comes from the database. */
  private async findPublicProt(refId: string): Promise<RewardSource> {
    if (typeof refId !== 'string' || !isUUID(refId)) {
      throw new BadRequestException('PROT not found or not public');
    }
    const rows = await this.dataSource.query<
      { id: string; provinsiKode: string | null }[]
    >(
      `SELECT id, "provinsiKode" FROM prot WHERE id = $1 AND status = 'ARSIP_NASIONAL'`,
      [refId],
    );
    if (rows.length === 0) {
      throw new BadRequestException('PROT not found or not public');
    }
    const kode = rows[0].provinsiKode;
    return {
      id: rows[0].id,
      provinsiKode: kode && PROVINCE_KODE.test(kode) ? kode : null,
    };
  }
}

function toBalanceView(row: BalanceRow): RewardBalanceView {
  return {
    xp: row.xp_total,
    points: row.points_total,
    pointsAvailable: row.points_available,
  };
}
