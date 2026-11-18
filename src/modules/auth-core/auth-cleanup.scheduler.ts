import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthTokenService } from './auth-token.service';
import { RefreshTokenService } from './refresh-token.service';

/** Every day at 03:15 server time (a quiet hour; off the full hour). */
export const AUTH_CLEANUP_CRON = '15 3 * * *';

/**
 * Daily cleanup (Phase 09): refresh tokens expired more than 7 days ago
 * (RefreshTokenService.cleanupExpired, Phase 07) and email tokens used or
 * expired more than 7 days ago (AuthTokenService.cleanup). Logs only counts.
 * One failing cleanup does not stop the other.
 */
@Injectable()
export class AuthCleanupScheduler {
  private readonly logger = new Logger(AuthCleanupScheduler.name);

  constructor(
    private readonly refreshTokens: RefreshTokenService,
    private readonly authTokens: AuthTokenService,
  ) {}

  @Cron(AUTH_CLEANUP_CRON, { name: 'auth-token-cleanup' })
  async run(
    now: Date = new Date(),
  ): Promise<{ refreshTokens: number | null; authTokens: number | null }> {
    const refreshTokens = await this.safely('refresh token', () =>
      this.refreshTokens.cleanupExpired(now),
    );
    const authTokens = await this.safely('email token', () =>
      this.authTokens.cleanup(now),
    );
    this.logger.log(
      `Auth cleanup: ${refreshTokens ?? 'failed'} refresh tokens, ${authTokens ?? 'failed'} email tokens deleted`,
    );
    return { refreshTokens, authTokens };
  }

  private async safely(
    label: string,
    task: () => Promise<number>,
  ): Promise<number | null> {
    try {
      return await task();
    } catch (error) {
      this.logger.error(
        `Auth cleanup of ${label}s failed (${(error as Error)?.name ?? 'UnknownError'})`,
      );
      return null;
    }
  }
}
