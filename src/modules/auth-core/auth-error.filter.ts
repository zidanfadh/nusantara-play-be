import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  InvalidOrExpiredTokenError,
  RefreshConflictError,
  RefreshTokenInvalidError,
} from './auth-errors';

type CodedAuthError =
  | RefreshConflictError
  | RefreshTokenInvalidError
  | InvalidOrExpiredTokenError;

/**
 * Auth errors carry a machine-readable code that the client needs:
 * - refresh: `error` = "refresh_conflict" (retry once on 409) or
 *   "invalid_refresh_token" (Phase 08)
 * - verify-email / reset-password: `code` = "invalid_or_expired_token"
 *   (Phase 09)
 * The global HttpExceptionFilter only keeps `message`, so this
 * controller-scoped filter (it runs instead of the global one) answers with
 * the same shape plus `error` / `code`.
 */
@Catch(
  RefreshConflictError,
  RefreshTokenInvalidError,
  InvalidOrExpiredTokenError,
)
export class AuthErrorFilter implements ExceptionFilter {
  catch(exception: CodedAuthError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const body = exception.getResponse() as {
      error?: string;
      code?: string;
      message: string;
    };
    ctx
      .getResponse<Response>()
      .status(exception.getStatus())
      .json({
        statusCode: exception.getStatus(),
        ...(body.error ? { error: body.error } : {}),
        ...(body.code ? { code: body.code } : {}),
        message: body.message,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      });
  }
}
