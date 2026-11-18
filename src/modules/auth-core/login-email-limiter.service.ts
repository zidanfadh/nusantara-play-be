import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { getStorageToken, ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/** Login attempts allowed per normalized email per window (Phase 08). */
export const LOGIN_EMAIL_LIMIT = 10;
export const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const THROTTLER_NAME = 'login-email';

/**
 * Per-account login limit (Phase 08): at most 10 attempts per email per
 * 15 minutes, counted for ANY email (known or not), so the 429 does not
 * reveal whether an account exists.
 *
 * Counts live in the app's existing throttler storage (the in-memory
 * ThrottlerStorageService registered by ThrottlerModule): no new store, and
 * the storage already expires its entries. Keys are a SHA-256 of the email,
 * so no address is held in memory in plain text.
 *
 * Limits: the count is per process. With N backend instances an attacker
 * gets up to N x 10 attempts per window, and a restart resets the counts.
 * The database lockout (LOGIN_MAX_FAILED / LOGIN_LOCK_MINUTES) is shared by
 * all instances and stays the real brute-force protection.
 */
@Injectable()
export class LoginEmailLimiter {
  constructor(
    @Inject(getStorageToken()) private readonly storage: ThrottlerStorage,
  ) {}

  static key(normalizedEmail: string): string {
    return `login-email:${createHash('sha256').update(normalizedEmail).digest('hex')}`;
  }

  /** Counts one attempt; throws 429 once the limit is exceeded. */
  async consume(normalizedEmail: string): Promise<void> {
    const record = await this.storage.increment(
      LoginEmailLimiter.key(normalizedEmail),
      LOGIN_EMAIL_WINDOW_MS,
      LOGIN_EMAIL_LIMIT,
      LOGIN_EMAIL_WINDOW_MS,
      THROTTLER_NAME,
    );
    if (record.isBlocked || record.totalHits > LOGIN_EMAIL_LIMIT) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
