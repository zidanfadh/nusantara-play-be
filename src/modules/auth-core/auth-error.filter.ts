import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  InvalidOrExpiredTokenError,
  LoginLockedError,
  RefreshConflictError,
  RefreshTokenInvalidError,
} from './auth-errors';

type CodedAuthError =
  | RefreshConflictError
  | RefreshTokenInvalidError
  | InvalidOrExpiredTokenError
  | LoginLockedError;

/**
 * Auth errors carry a machine-readable code that the client needs:
 * - refresh: `error` = "refresh_conflict" (retry once on 409) or
 *   "invalid_refresh_token" (Phase 08)
 * - verify-email / reset-password: `code` = "invalid_or_expired_token"
 *   (Phase 09) and `reason` = "used" | "expired" | "invalid" (Phase 29)
 * - login: `code` = "login_locked" + `retryAfterSeconds` and a Retry-After
 *   header (Phase 29)
 * The global HttpExceptionFilter only keeps `message`, so this
 * controller-scoped filter (it runs instead of the global one) answers with
 * the same shape plus `error` / `code` / `reason` / `retryAfterSeconds`.
 */
@Catch(
  RefreshConflictError,
  RefreshTokenInvalidError,
  InvalidOrExpiredTokenError,
  LoginLockedError,
)
export class AuthErrorFilter implements ExceptionFilter {
  catch(exception: CodedAuthError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const body = exception.getResponse() as {
      error?: string;
      code?: string;
      reason?: string;
      retryAfterSeconds?: number;
      message: string;
    };
    const response = ctx.getResponse<Response>();
    if (typeof body.retryAfterSeconds === 'number') {
      response.setHeader('Retry-After', String(body.retryAfterSeconds));
    }
    response.status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      ...(body.error ? { error: body.error } : {}),
      ...(body.code ? { code: body.code } : {}),
      ...(body.reason ? { reason: body.reason } : {}),
      ...(typeof body.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: body.retryAfterSeconds }
        : {}),
      message: body.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}
