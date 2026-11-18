import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { DataSource, EntityManager } from 'typeorm';
import { AuthConfig, readAuthConfig } from '../../config/auth.config';
import { RefreshConflictError, RefreshTokenInvalidError } from './auth-errors';
import { RefreshToken } from './entities/refresh-token.entity';

export interface RefreshTokenMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedRefreshToken {
  /** The raw token. Returned ONCE; only its SHA-256 hash is stored. */
  token: string;
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
}

export const REFRESH_REVOKE_REASONS = {
  rotated: 'rotated',
  reuseDetected: 'reuse_detected',
} as const;

/** Rows expired longer than this are deleted by cleanupExpired(). */
export const REFRESH_CLEANUP_AFTER_DAYS = 7;

const USER_AGENT_MAX = 512;
const DAY_MS = 24 * 60 * 60 * 1000;

export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

type RotateOutcome =
  | { kind: 'rotated'; token: IssuedRefreshToken }
  | { kind: 'invalid'; reason: 'unknown' | 'expired' | 'reuse_detected' }
  | { kind: 'conflict' };

/**
 * Rotating refresh tokens (Phase 07). Every claim on a token is a
 * conditional UPDATE (`revoked_at IS NULL`) inside a transaction, so two
 * parallel rotations of one token can never both succeed.
 */
@Injectable()
export class RefreshTokenService {
  private readonly config: AuthConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() configService?: ConfigService,
  ) {
    this.config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
  }

  /** Starts a new token family for a fresh login. */
  async issue(
    userId: string,
    meta: RefreshTokenMeta = {},
    manager: EntityManager = this.dataSource.manager,
  ): Promise<IssuedRefreshToken> {
    return this.insertToken(manager, userId, randomUUID(), meta);
  }

  /**
   * Exchanges a valid refresh token for a new one in the same family.
   * - unknown or expired token: 401 (RefreshTokenInvalidError)
   * - token rotated less than REFRESH_REUSE_GRACE_SECONDS ago: 409
   *   RefreshConflictError, family untouched (parallel tabs)
   * - any other reuse of a revoked token: the whole family is revoked
   *   (reason 'reuse_detected') and 401
   */
  async rotate(
    rawToken: string,
    meta: RefreshTokenMeta = {},
  ): Promise<IssuedRefreshToken> {
    const tokenHash = hashRefreshToken(rawToken);
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RotateOutcome> => {
        const repo = manager.getRepository(RefreshToken);
        const current = await repo.findOneBy({ token_hash: tokenHash });
        if (!current) {
          return { kind: 'invalid', reason: 'unknown' };
        }
        const now = new Date();
        if (current.expires_at.getTime() <= now.getTime()) {
          return { kind: 'invalid', reason: 'expired' };
        }
        if (current.revoked_at) {
          return this.handleReuse(manager, current, now);
        }

        const newId = randomUUID();
        // Claim the token: only one concurrent caller can flip revoked_at.
        const claim = await manager
          .createQueryBuilder()
          .update(RefreshToken)
          .set({
            revoked_at: now,
            revoked_reason: REFRESH_REVOKE_REASONS.rotated,
            replaced_by_id: newId,
          })
          .where('id = :id AND revoked_at IS NULL', { id: current.id })
          .execute();

        if (claim.affected !== 1) {
          // Lost the race: another request rotated it after our read.
          const latest = await repo.findOneByOrFail({ id: current.id });
          return this.handleReuse(manager, latest, new Date());
        }

        const token = await this.insertToken(
          manager,
          current.user_id,
          current.family_id,
          meta,
          newId,
        );
        return { kind: 'rotated', token };
      },
    );

    if (outcome.kind === 'rotated') {
      return outcome.token;
    }
    if (outcome.kind === 'conflict') {
      throw new RefreshConflictError();
    }
    throw new RefreshTokenInvalidError(outcome.reason);
  }

  /** Revokes every still-active token of a family. Returns the row count. */
  async revokeFamily(
    familyId: string,
    reason: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('family_id = :familyId AND revoked_at IS NULL', { familyId })
      .execute();
    return result.affected ?? 0;
  }

  /** Revokes every still-active token of a user (all devices). */
  async revokeAllForUser(
    userId: string,
    reason: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revoked_at: new Date(), revoked_reason: reason })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();
    return result.affected ?? 0;
  }

  /**
   * Deletes tokens that expired more than REFRESH_CLEANUP_AFTER_DAYS (7)
   * days ago. No cron yet (a later phase schedules it). Returns the count.
   */
  async cleanupExpired(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - REFRESH_CLEANUP_AFTER_DAYS * DAY_MS,
    );
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expires_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  private async handleReuse(
    manager: EntityManager,
    token: RefreshToken,
    now: Date,
  ): Promise<RotateOutcome> {
    const graceMs = this.config.refreshReuseGraceSeconds * 1000;
    if (
      token.revoked_reason === REFRESH_REVOKE_REASONS.rotated &&
      token.revoked_at &&
      now.getTime() - token.revoked_at.getTime() < graceMs
    ) {
      return { kind: 'conflict' };
    }
    await this.revokeFamily(
      token.family_id,
      REFRESH_REVOKE_REASONS.reuseDetected,
      manager,
    );
    return { kind: 'invalid', reason: 'reuse_detected' };
  }

  private async insertToken(
    manager: EntityManager,
    userId: string,
    familyId: string,
    meta: RefreshTokenMeta,
    id: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.refreshTokenTtlDays * DAY_MS,
    );
    await manager.getRepository(RefreshToken).insert({
      id,
      user_id: userId,
      family_id: familyId,
      token_hash: hashRefreshToken(token),
      expires_at: expiresAt,
      user_agent: meta.userAgent
        ? meta.userAgent.slice(0, USER_AGENT_MAX)
        : null,
      ip: meta.ip && isIP(meta.ip) ? meta.ip : null,
    });
    return { token, id, userId, familyId, expiresAt };
  }
}
