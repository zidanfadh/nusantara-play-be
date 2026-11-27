import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { DataSource, EntityManager } from 'typeorm';
import { AuthConfig, readAuthConfig } from '../../config/auth.config';
import type { InvalidTokenReason } from './auth-errors';
import { AUTH_TOKEN_TYPES, AuthTokenType } from './entities/auth-token.entity';

/** Used or expired tokens older than this are deleted by cleanup(). */
export const AUTH_TOKEN_CLEANUP_AFTER_DAYS = 7;

export function hashAuthToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export interface CreatedAuthToken {
  /** The raw token. Returned ONCE (it goes into the email link only). */
  token: string;
  expiresAt: Date;
}

/**
 * One-time email tokens (Phase 09): email verification (24 h) and password
 * reset (1 h). 32 random bytes, base64url; only the SHA-256 hex hash is
 * stored in auth_tokens.
 *
 * - create(): in one transaction, serialized per (user, type) with an
 *   advisory lock, deletes the user's older unused tokens of that type and
 *   inserts the new one, so only the newest link works.
 * - consume(): single-use and race-safe with ONE conditional UPDATE
 *   (used_at IS NULL AND expires_at > now()); of two parallel calls exactly
 *   one gets the user id.
 */
@Injectable()
export class AuthTokenService {
  private readonly config: AuthConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() configService?: ConfigService,
  ) {
    this.config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
  }

  /** Lifetime of a token type in minutes. */
  ttlMinutes(type: AuthTokenType): number {
    return type === AUTH_TOKEN_TYPES.passwordReset
      ? this.config.passwordResetTtlMinutes
      : this.config.emailVerificationTtlHours * 60;
  }

  async create(
    userId: string,
    type: AuthTokenType,
    requestedIp: string | null = null,
  ): Promise<CreatedAuthToken> {
    const token = randomBytes(32).toString('base64url');
    const rows = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('auth_tokens:' || $1 || ':' || $2))`,
        [userId, type],
      );
      await manager.query(
        `DELETE FROM auth_tokens
          WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
        [userId, type],
      );
      return manager.query<{ expires_at: Date }[]>(
        `INSERT INTO auth_tokens (user_id, type, token_hash, expires_at, requested_ip)
         VALUES ($1, $2, $3, now() + make_interval(mins => $4::int), $5)
         RETURNING expires_at`,
        [
          userId,
          type,
          hashAuthToken(token),
          this.ttlMinutes(type),
          requestedIp && isIP(requestedIp) ? requestedIp : null,
        ],
      );
    });
    return { token, expiresAt: rows[0].expires_at };
  }

  /**
   * Read-only: the user id of a token that is currently valid (unused, not
   * expired, right type), else null. Does NOT use the token; consume() is
   * the only claim.
   */
  async peek(
    rawToken: string,
    type: AuthTokenType,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<string | null> {
    const rows = await manager.query<{ user_id: string }[]>(
      `SELECT user_id FROM auth_tokens
        WHERE token_hash = $1 AND type = $2
          AND used_at IS NULL AND expires_at > now()`,
      [hashAuthToken(rawToken), type],
    );
    return rows[0]?.user_id ?? null;
  }

  /**
   * Read-only (Phase 29): why a token is unusable, for the answer's
   * `reason`. `used` = consumed, `expired` = unused but past expires_at,
   * `invalid` = no such token of this type (unknown, other type, or deleted
   * because a newer link replaced it, or cleaned up). Call it only after
   * peek() / consume() refused the token.
   */
  async classifyUnusable(
    rawToken: string,
    type: AuthTokenType,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<InvalidTokenReason> {
    const rows = await manager.query<{ used: boolean; expired: boolean }[]>(
      `SELECT used_at IS NOT NULL AS used, expires_at <= now() AS expired
         FROM auth_tokens
        WHERE token_hash = $1 AND type = $2`,
      [hashAuthToken(rawToken), type],
    );
    const row = rows[0];
    if (!row) return 'invalid';
    if (row.used) return 'used';
    return row.expired ? 'expired' : 'invalid';
  }

  /**
   * Marks the token used and returns its user id, or null when it is
   * unknown, of another type, already used or expired. One conditional
   * UPDATE: race-safe. Pass the transaction's manager to make the claim part
   * of a larger write (it is rolled back with it).
   */
  async consume(
    rawToken: string,
    type: AuthTokenType,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<string | null> {
    const result = await manager.query<
      [{ user_id: string }[], number] | { user_id: string }[]
    >(
      `UPDATE auth_tokens
          SET used_at = now()
        WHERE token_hash = $1 AND type = $2
          AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [hashAuthToken(rawToken), type],
    );
    return firstUserId(result);
  }

  /**
   * Deletes tokens that were used, or expired, more than
   * AUTH_TOKEN_CLEANUP_AFTER_DAYS (7) days ago. Returns the count.
   */
  async cleanup(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - AUTH_TOKEN_CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.dataSource.query<[unknown[], number]>(
      `DELETE FROM auth_tokens
        WHERE expires_at < $1 OR (used_at IS NOT NULL AND used_at < $1)`,
      [cutoff],
    );
    return result[1] ?? 0;
  }
}

/**
 * The pg driver returns [rows, affectedCount] for UPDATE ... RETURNING
 * through TypeORM's query(); be tolerant of a plain rows array too.
 */
function firstUserId(
  result: [{ user_id: string }[], number] | { user_id: string }[],
): string | null {
  const rows = Array.isArray(result[0])
    ? (result[0] as { user_id: string }[])
    : (result as { user_id: string }[]);
  return rows[0]?.user_id ?? null;
}
