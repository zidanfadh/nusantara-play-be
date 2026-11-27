import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Why an email token is unusable (Phase 29, additive): `used` (already
 * consumed), `expired`, or `invalid` (unknown, of another type, or replaced
 * by a newer link). Only the holder of the 32-byte token can ask, so the
 * reason reveals nothing about other accounts.
 */
export type InvalidTokenReason = 'used' | 'expired' | 'invalid';

/**
 * 400 invalid_or_expired_token (Phase 09): verify-email / reset-password
 * with a token that is unknown, of another type, already used or expired.
 * One code for every case; since Phase 29 `reason` tells them apart.
 */
export class InvalidOrExpiredTokenError extends BadRequestException {
  readonly code = 'invalid_or_expired_token';

  constructor(readonly reason: InvalidTokenReason = 'invalid') {
    super({
      statusCode: 400,
      code: 'invalid_or_expired_token',
      reason,
      message: 'The link is invalid or has expired',
    });
  }
}

/**
 * 429 login_locked (Phase 29, additive): too many failed logins for this
 * email (LoginFailureTracker). Given for known AND unknown emails alike, so
 * it reveals no account. `retryAfterSeconds` = remaining lock time.
 */
export class LoginLockedError extends HttpException {
  readonly code = 'login_locked';

  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: 429,
        code: 'login_locked',
        retryAfterSeconds,
        message: 'Too many failed login attempts. Try again later.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Thrown by every KeyService/TokenService method that needs keys while
 * local auth is disabled (a JWT_* variable is missing or a key is invalid).
 * Deliberately NOT an HttpException: it is a server configuration problem.
 */
export class LocalAuthDisabledError extends Error {
  constructor(reason: string) {
    super(`Local auth is disabled: ${reason}`);
    this.name = 'LocalAuthDisabledError';
  }
}

/** Access token failed verification (signature, iss, aud, exp, kid, ...). */
export class AccessTokenInvalidError extends Error {
  constructor(reason: string) {
    super(`Invalid access token: ${reason}`);
    this.name = 'AccessTokenInvalidError';
  }
}

export type RefreshTokenInvalidReason =
  | 'unknown'
  | 'expired'
  | 'reuse_detected'
  | 'revoked';

/** 401: unknown, expired, revoked or reused refresh token. */
export class RefreshTokenInvalidError extends UnauthorizedException {
  constructor(readonly reason: RefreshTokenInvalidReason) {
    super({
      statusCode: 401,
      error: 'invalid_refresh_token',
      message: 'Invalid refresh token',
    });
  }
}

/**
 * 409 refresh_conflict: the presented token was rotated a moment ago
 * (within REFRESH_REUSE_GRACE_SECONDS), typically by a second browser tab
 * refreshing at the same time. The family stays valid; the client retries
 * once with the newer cookie.
 */
export class RefreshConflictError extends ConflictException {
  readonly code = 'refresh_conflict';

  constructor() {
    super({
      statusCode: 409,
      error: 'refresh_conflict',
      message: 'Refresh token was just rotated; retry with the newer token',
    });
  }
}
