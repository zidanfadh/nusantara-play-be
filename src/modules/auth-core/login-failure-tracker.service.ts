import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readAuthConfig } from '../../config/auth.config';
import { LoginLockedError } from './auth-errors';

/** A failure is remembered this long after the last one (the database counter never forgets). */
export const FAILURE_MEMORY_MS = 24 * 60 * 60 * 1000;
/** Upper bound of remembered emails per process; the oldest entries go first. */
export const MAX_TRACKED_EMAILS = 50_000;

interface Entry {
  failures: number;
  /** Epoch ms; 0 = not blocked. */
  blockedUntil: number;
  /** Epoch ms after which the entry is forgotten. */
  forgetAt: number;
}

/**
 * Tells the user how long a login is locked, WITHOUT revealing whether the email has an account
 * (Phase 29, additive). The database lockout (`user_credentials.failed_login_count` / `locked_until`, Phase 08)
 * stays the real protection; it answers the generic 401 for a locked account. This tracker mirrors the same
 * rule for EVERY email, known or unknown: it counts generic login failures per normalized email and, from the
 * LOGIN_MAX_FAILED-th failure on, answers 429 `{code: "login_locked", retryAfterSeconds}` for
 * LOGIN_LOCK_MINUTES. Like the database counter it is reset only by a successful login, so after a lock
 * expires the next failure locks again at once. An unknown email therefore gets exactly the answers a real
 * account gets.
 *
 * In-memory per process, keys = SHA-256 of the email (no address held in plain text). With N instances or
 * after a restart the 429 may not appear while the database lock still holds: the login then answers the
 * generic 401 as before (never a wrong "you may try again").
 */
@Injectable()
export class LoginFailureTracker {
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailed: number;
  private readonly lockMs: number;

  constructor(
    @Optional() configService?: ConfigService,
    /** Injectable clock for tests. */
    @Optional() private readonly now: () => number = () => Date.now(),
  ) {
    const config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
    this.maxFailed = config.loginMaxFailed;
    this.lockMs = config.loginLockMinutes * 60_000;
  }

  static key(normalizedEmail: string): string {
    return createHash('sha256').update(normalizedEmail).digest('hex');
  }

  /** Seconds the email is still locked (0 = not locked). */
  remainingSeconds(normalizedEmail: string): number {
    const entry = this.read(LoginFailureTracker.key(normalizedEmail));
    if (!entry || entry.blockedUntil <= this.now()) return 0;
    return Math.ceil((entry.blockedUntil - this.now()) / 1000);
  }

  /** Throws 429 login_locked while the email is locked. */
  assertNotLocked(normalizedEmail: string): void {
    const seconds = this.remainingSeconds(normalizedEmail);
    if (seconds > 0) throw new LoginLockedError(seconds);
  }

  /**
   * Counts one generic login failure. Throws 429 login_locked when this failure reaches the limit (the same
   * attempt that locks the database row of a real account).
   */
  recordFailure(normalizedEmail: string): void {
    const key = LoginFailureTracker.key(normalizedEmail);
    const now = this.now();
    const entry = this.read(key) ?? {
      failures: 0,
      blockedUntil: 0,
      forgetAt: 0,
    };
    entry.failures += 1;
    entry.forgetAt = now + FAILURE_MEMORY_MS;
    if (entry.failures >= this.maxFailed) {
      entry.blockedUntil = now + this.lockMs;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune(now);
    if (entry.blockedUntil > now) {
      throw new LoginLockedError(Math.ceil(this.lockMs / 1000));
    }
  }

  /** A successful login (correct password) forgets the email, like the database counter. */
  reset(normalizedEmail: string): void {
    this.entries.delete(LoginFailureTracker.key(normalizedEmail));
  }

  /** For tests and monitoring: how many emails are remembered. */
  get size(): number {
    return this.entries.size;
  }

  private read(key: string): Entry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.forgetAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  private prune(now: number): void {
    if (this.entries.size <= MAX_TRACKED_EMAILS) return;
    for (const [key, entry] of this.entries) {
      if (entry.forgetAt <= now) this.entries.delete(key);
    }
    // Still too many: drop the least recently failed (Map keeps insertion order; recordFailure re-inserts).
    for (const key of this.entries.keys()) {
      if (this.entries.size <= MAX_TRACKED_EMAILS) break;
      this.entries.delete(key);
    }
  }
}
