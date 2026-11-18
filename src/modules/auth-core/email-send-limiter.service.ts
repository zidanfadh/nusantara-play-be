import { Inject, Injectable } from '@nestjs/common';
import { getStorageToken, ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/** Emails per normalized address and purpose per window (Phase 09). */
export const EMAIL_SEND_LIMIT = 3;
export const EMAIL_SEND_WINDOW_MS = 60 * 60 * 1000;
const THROTTLER_NAME = 'auth-email';

/**
 * Two separate buckets per address:
 * - 'verification': registration emails (verification link or "akun sudah
 *   ada") and POST /resend-verification
 * - 'password_reset': POST /forgot-password
 */
export type EmailSendPurpose = 'verification' | 'password_reset';

/**
 * Per-address limit of auth emails (Phase 09): at most 3 per purpose per
 * hour. Counted for EVERY request, whether or not an account exists, and it
 * never changes the HTTP response (the endpoints always answer 200): over
 * the limit the email is simply not sent.
 *
 * Same storage as LoginEmailLimiter: the app's in-memory throttler storage,
 * keys = SHA-256 of the normalized email (no address held in plain text).
 * Per process: with N instances up to N x 3 emails per hour.
 */
@Injectable()
export class EmailSendLimiter {
  constructor(
    @Inject(getStorageToken()) private readonly storage: ThrottlerStorage,
  ) {}

  static key(purpose: EmailSendPurpose, normalizedEmail: string): string {
    return `auth-email:${purpose}:${createHash('sha256').update(normalizedEmail).digest('hex')}`;
  }

  /** Counts one request; true while the address is within the limit. */
  async tryConsume(
    purpose: EmailSendPurpose,
    normalizedEmail: string,
  ): Promise<boolean> {
    const record = await this.storage.increment(
      EmailSendLimiter.key(purpose, normalizedEmail),
      EMAIL_SEND_WINDOW_MS,
      EMAIL_SEND_LIMIT,
      EMAIL_SEND_WINDOW_MS,
      THROTTLER_NAME,
    );
    return !record.isBlocked && record.totalHits <= EMAIL_SEND_LIMIT;
  }
}
