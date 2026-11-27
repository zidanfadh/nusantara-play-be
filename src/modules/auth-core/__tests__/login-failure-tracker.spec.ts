/**
 * LoginFailureTracker (Phase 29): the remaining lock time for ANY email,
 * mirroring the database lockout rule (LOGIN_MAX_FAILED failures lock for
 * LOGIN_LOCK_MINUTES; only a success resets the count).
 */
import { LoginLockedError } from '../auth-errors';
import {
  FAILURE_MEMORY_MS,
  LoginFailureTracker,
  MAX_TRACKED_EMAILS,
} from '../login-failure-tracker.service';

function tracker(env: Record<string, string> = {}) {
  let now = Date.UTC(2026, 10, 27, 10, 0, 0);
  const config = { get: (key: string) => env[key] };
  const t = new LoginFailureTracker(config as never, () => now);
  return {
    t,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function lockedError(fn: () => void): LoginLockedError | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof LoginLockedError) return error;
    throw error;
  }
}

describe('LoginFailureTracker (Phase 29)', () => {
  it('locks at the 5th failure for 15 minutes (defaults) and says so on that very attempt', () => {
    const { t } = tracker();
    for (let i = 0; i < 4; i += 1) {
      expect(lockedError(() => t.recordFailure('a@example.test'))).toBeNull();
    }
    expect(t.remainingSeconds('a@example.test')).toBe(0);
    const error = lockedError(() => t.recordFailure('a@example.test'));
    expect(error?.retryAfterSeconds).toBe(900);
    expect(error?.getStatus()).toBe(429);
    expect(error?.getResponse()).toEqual({
      statusCode: 429,
      code: 'login_locked',
      retryAfterSeconds: 900,
      message: 'Too many failed login attempts. Try again later.',
    });
    expect(t.remainingSeconds('a@example.test')).toBe(900);
  });

  it('assertNotLocked throws the remaining time (rounded up) while locked, then lets the next attempt through', () => {
    const { t, advance } = tracker();
    for (let i = 0; i < 4; i += 1) t.recordFailure('b@example.test');
    lockedError(() => t.recordFailure('b@example.test'));
    advance(60_500);
    expect(
      lockedError(() => t.assertNotLocked('b@example.test'))?.retryAfterSeconds,
    ).toBe(840);
    advance(840_000);
    expect(lockedError(() => t.assertNotLocked('b@example.test'))).toBeNull();
  });

  it('after a lock expired, the next failure locks again at once (like the database counter)', () => {
    const { t, advance } = tracker();
    for (let i = 0; i < 4; i += 1) t.recordFailure('c@example.test');
    lockedError(() => t.recordFailure('c@example.test'));
    advance(900_001);
    expect(
      lockedError(() => t.recordFailure('c@example.test'))?.retryAfterSeconds,
    ).toBe(900);
  });

  it('a success resets the email; other emails are independent', () => {
    const { t } = tracker();
    for (let i = 0; i < 4; i += 1) t.recordFailure('d@example.test');
    t.reset('d@example.test');
    expect(lockedError(() => t.recordFailure('d@example.test'))).toBeNull();
    for (let i = 0; i < 4; i += 1) t.recordFailure('e@example.test');
    expect(t.remainingSeconds('f@example.test')).toBe(0);
  });

  it('follows LOGIN_MAX_FAILED and LOGIN_LOCK_MINUTES', () => {
    const { t } = tracker({ LOGIN_MAX_FAILED: '3', LOGIN_LOCK_MINUTES: '2' });
    t.recordFailure('g@example.test');
    t.recordFailure('g@example.test');
    expect(
      lockedError(() => t.recordFailure('g@example.test'))?.retryAfterSeconds,
    ).toBe(120);
  });

  it('forgets failures a day after the last one', () => {
    const { t, advance } = tracker();
    for (let i = 0; i < 4; i += 1) t.recordFailure('h@example.test');
    advance(FAILURE_MEMORY_MS + 1);
    expect(t.size).toBe(1);
    expect(lockedError(() => t.recordFailure('h@example.test'))).toBeNull();
  });

  it('keeps no email in plain text and bounds its memory', () => {
    const { t } = tracker();
    t.recordFailure('Private@Example.test');
    const keys = [
      ...(t as unknown as { entries: Map<string, unknown> }).entries.keys(),
    ];
    expect(keys).toEqual([LoginFailureTracker.key('Private@Example.test')]);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
    for (let i = 0; i < MAX_TRACKED_EMAILS + 10; i += 1)
      t.recordFailure(`n${i}@example.test`);
    expect(t.size).toBeLessThanOrEqual(MAX_TRACKED_EMAILS);
  });
});
