import { ConflictException, UnauthorizedException } from '@nestjs/common';

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
