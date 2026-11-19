/**
 * Read side of the rewards (Phase 15): GET /api/rewards/me, /me/ledger,
 * /me/paspor and /leaderboard. Never writes. Other users appear only in the
 * public user shape (toPublicUser); never email or phone.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PublicUser, toPublicUser } from '../../common/serializers/user-shape';
import { LeaderboardScope } from './dto/rewards.dto';
import { RewardCurrency } from './entities/reward-ledger-entry.entity';
import { levelForXp, xpForLevel } from './level';
import {
  LEADERBOARD_CACHE_MS,
  LEADERBOARD_SIZE,
  REWARD_RULE_CODES,
} from './rewards.rules';

export interface RewardsMe {
  xp: number;
  level: number;
  /** Total XP at which the current level starts. */
  xpForCurrentLevel: number;
  /** Total XP needed for the next level. */
  xpForNextLevel: number;
  pointsTotal: number;
  pointsAvailable: number;
  pointsOnHold: number;
}

export interface LedgerItem {
  id: string;
  currency: RewardCurrency;
  amount: number;
  rule_code: string;
  source_type: string;
  source_id: string | null;
  provinsi_kode: string | null;
  available_at: Date | null;
  created_at: Date;
  /** ADMIN_ADJUST rows only. */
  reason?: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PasporProvince {
  provinsi_kode: string;
  nama: string;
  stamped: boolean;
  stamped_at: Date | null;
  prot_viewed: number;
  prot_count: number;
}

export interface PasporView {
  total_provinces: number;
  stamped_count: number;
  provinces: PasporProvince[];
}

export interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  xp: number;
  level: number;
}

export interface LeaderboardView {
  scope: LeaderboardScope;
  provinsi_kode: string | null;
  /** When the cached top list was computed. */
  generated_at: Date;
  entries: LeaderboardEntry[];
  /** The caller's own rank (live); rank null while the caller has no XP there. */
  me: { rank: number | null; xp: number };
}

interface CachedBoard {
  expiresAt: number;
  generatedAt: Date;
  entries: LeaderboardEntry[];
}

/** XP per user in one province: only ledger rows tagged with that province. */
const PROVINCE_XP_CTE = `province_xp AS (
  SELECT user_id, SUM(amount)::int AS xp
    FROM reward_ledger
   WHERE currency = 'XP' AND provinsi_kode = $1
   GROUP BY user_id
  HAVING SUM(amount) > 0)`;

@Injectable()
export class RewardsQueryService {
  private readonly leaderboardCache = new Map<string, CachedBoard>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getMe(userId: string): Promise<RewardsMe> {
    const rows = await this.dataSource.query<
      { xp: number; points: number; points_available: number }[]
    >(
      `SELECT COALESCE(b.xp_total, 0) AS xp,
              COALESCE(b.points_total, 0) AS points,
              (SELECT COALESCE(SUM(amount), 0)::int FROM reward_ledger
                WHERE user_id = $1 AND currency = 'POINTS' AND available_at <= now()) AS points_available
         FROM (SELECT $1::uuid AS user_id) me
         LEFT JOIN reward_balances b ON b.user_id = me.user_id`,
      [userId],
    );
    const { xp, points, points_available } = rows[0];
    const level = levelForXp(xp);
    return {
      xp,
      level,
      xpForCurrentLevel: xpForLevel(level),
      xpForNextLevel: xpForLevel(level + 1),
      pointsTotal: points,
      pointsAvailable: points_available,
      pointsOnHold: points - points_available,
    };
  }

  async getLedger(
    userId: string,
    page: number,
    limit: number,
  ): Promise<Paginated<LedgerItem>> {
    const [rows, countRows] = await Promise.all([
      this.dataSource.query<
        (Omit<LedgerItem, 'reason'> & {
          metadata: Record<string, unknown> | null;
        })[]
      >(
        `SELECT id, currency, amount, rule_code, source_type, source_id,
                provinsi_kode, available_at, created_at, metadata
           FROM reward_ledger
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2 OFFSET $3`,
        [userId, limit, (page - 1) * limit],
      ),
      this.dataSource.query<{ total: number }[]>(
        'SELECT COUNT(*)::int AS total FROM reward_ledger WHERE user_id = $1',
        [userId],
      ),
    ]);
    const data = rows.map(({ metadata, ...item }) => {
      const reason = metadata?.reason;
      return item.rule_code === REWARD_RULE_CODES.adminAdjust &&
        typeof reason === 'string'
        ? { ...item, reason }
        : item;
    });
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /** Every province of the daerah list with the caller's Paspor state. */
  async getPaspor(userId: string): Promise<PasporView> {
    const provinces = await this.dataSource.query<PasporProvince[]>(
      `SELECT d.kode AS provinsi_kode,
              d.nama,
              (s.user_id IS NOT NULL) AS stamped,
              s.stamped_at,
              COALESCE(v.viewed, 0) AS prot_viewed,
              COALESCE(p.prot_count, 0) AS prot_count
         FROM daerah d
         LEFT JOIN user_province_stamps s
                ON s.user_id = $1 AND s.provinsi_kode = d.kode
         LEFT JOIN (SELECT "provinsiKode" AS kode, COUNT(*)::int AS prot_count
                      FROM prot WHERE status = 'ARSIP_NASIONAL'
                     GROUP BY "provinsiKode") p ON p.kode = d.kode
         LEFT JOIN (SELECT v.provinsi_kode AS kode, COUNT(*)::int AS viewed
                      FROM user_prot_views v
                      JOIN prot pr ON pr.id = v.prot_id AND pr.status = 'ARSIP_NASIONAL'
                                  AND pr."provinsiKode" = v.provinsi_kode
                     WHERE v.user_id = $1
                     GROUP BY v.provinsi_kode) v ON v.kode = d.kode
        WHERE d.level = 'provinsi'
        ORDER BY d.kode`,
      [userId],
    );
    return {
      total_provinces: provinces.length,
      stamped_count: provinces.filter((p) => p.stamped).length,
      provinces,
    };
  }

  async getLeaderboard(
    userId: string,
    scope: LeaderboardScope,
    provinsiKode: string | undefined,
  ): Promise<LeaderboardView> {
    let kode: string | null = null;
    if (scope === 'province') {
      if (!provinsiKode) {
        throw new BadRequestException(
          'provinsiKode is required for scope=province',
        );
      }
      const rows = await this.dataSource.query<unknown[]>(
        `SELECT 1 FROM daerah WHERE kode = $1 AND level = 'provinsi'`,
        [provinsiKode],
      );
      if (rows.length === 0) {
        throw new BadRequestException('Unknown province');
      }
      kode = provinsiKode;
    }
    const board = await this.cachedBoard(kode);
    return {
      scope,
      provinsi_kode: kode,
      generated_at: board.generatedAt,
      entries: board.entries,
      me: await this.ownRank(userId, kode),
    };
  }

  /** Test hook: forget the cached leaderboards. */
  clearLeaderboardCache(): void {
    this.leaderboardCache.clear();
  }

  private async cachedBoard(kode: string | null): Promise<CachedBoard> {
    const key = kode === null ? 'national' : `province:${kode}`;
    const now = Date.now();
    const cached = this.leaderboardCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached;
    }
    const entries =
      kode === null
        ? await this.queryTop(
            `SELECT u.id, u.full_name, u.avatar_url, u.institution,
                    b.xp_total AS xp, b.level,
                    RANK() OVER (ORDER BY b.xp_total DESC)::int AS rank
               FROM reward_balances b
               JOIN users u ON u.id = b.user_id
              WHERE b.xp_total > 0 AND u.status = 'active'
              ORDER BY b.xp_total DESC, u.id
              LIMIT ${LEADERBOARD_SIZE}`,
            [],
          )
        : await this.queryTop(
            `WITH ${PROVINCE_XP_CTE}
             SELECT u.id, u.full_name, u.avatar_url, u.institution,
                    px.xp, COALESCE(b.level, 1) AS level,
                    RANK() OVER (ORDER BY px.xp DESC)::int AS rank
               FROM province_xp px
               JOIN users u ON u.id = px.user_id
               LEFT JOIN reward_balances b ON b.user_id = px.user_id
              WHERE u.status = 'active'
              ORDER BY px.xp DESC, u.id
              LIMIT ${LEADERBOARD_SIZE}`,
            [kode],
          );
    const board: CachedBoard = {
      expiresAt: now + LEADERBOARD_CACHE_MS,
      generatedAt: new Date(now),
      entries,
    };
    this.leaderboardCache.set(key, board);
    return board;
  }

  private async queryTop(
    sql: string,
    params: unknown[],
  ): Promise<LeaderboardEntry[]> {
    const rows = await this.dataSource.query<
      {
        id: string;
        full_name: string;
        avatar_url: string | null;
        institution: string | null;
        xp: number;
        level: number;
        rank: number;
      }[]
    >(sql, params);
    return rows.map((row) => ({
      rank: row.rank,
      user: toPublicUser(row) as PublicUser,
      xp: row.xp,
      // The user's overall level (also on the province board).
      level: row.level,
    }));
  }

  /** Live rank of the caller: 1 + users with more XP in the same scope. */
  private async ownRank(
    userId: string,
    kode: string | null,
  ): Promise<{ rank: number | null; xp: number }> {
    const rows =
      kode === null
        ? await this.dataSource.query<{ xp: number; ahead: number }[]>(
            `SELECT COALESCE(mine.xp_total, 0) AS xp,
                    (SELECT COUNT(*)::int FROM reward_balances b
                       JOIN users u ON u.id = b.user_id
                      WHERE u.status = 'active' AND b.xp_total > COALESCE(mine.xp_total, 0)) AS ahead
               FROM (SELECT $1::uuid AS user_id) me
               LEFT JOIN reward_balances mine ON mine.user_id = me.user_id`,
            [userId],
          )
        : await this.dataSource.query<{ xp: number; ahead: number }[]>(
            `WITH ${PROVINCE_XP_CTE},
             mine AS (SELECT COALESCE((SELECT xp FROM province_xp WHERE user_id = $2), 0) AS xp)
             SELECT mine.xp,
                    (SELECT COUNT(*)::int FROM province_xp px
                       JOIN users u ON u.id = px.user_id
                      WHERE u.status = 'active' AND px.xp > mine.xp) AS ahead
               FROM mine`,
            [kode, userId],
          );
    const { xp, ahead } = rows[0];
    return { rank: xp > 0 ? ahead + 1 : null, xp };
  }
}
