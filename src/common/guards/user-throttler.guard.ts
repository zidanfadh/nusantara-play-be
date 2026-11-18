import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global rate limit per user (Phase 06, P3): logged-in requests are tracked
 * by user id, anonymous requests by client IP (req.ip, see TRUST_PROXY).
 *
 * Needs req.user, so it is registered AFTER the global JwtAuthGuard in
 * app.module.ts (APP_GUARDs run in registration order). Browser traffic
 * reaches the backend through Vercel, so many users share few IPs; per-user
 * tracking keeps one user from exhausting everybody's limit.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: unknown } | undefined;
    if (typeof user?.id === 'string' && user.id !== '') {
      return Promise.resolve(`user:${user.id}`);
    }
    const ip = typeof req.ip === 'string' && req.ip !== '' ? req.ip : 'unknown';
    return Promise.resolve(`ip:${ip}`);
  }
}
