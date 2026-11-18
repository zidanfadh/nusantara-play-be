import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RefreshConflictError, RefreshTokenInvalidError } from './auth-errors';

/**
 * Refresh errors carry a machine-readable `error` code ("refresh_conflict",
 * "invalid_refresh_token") that the client needs (retry once on 409). The
 * global HttpExceptionFilter only keeps `message`, so this controller-scoped
 * filter (it runs instead of the global one) answers with the same shape
 * plus `error` (Phase 08).
 */
@Catch(RefreshConflictError, RefreshTokenInvalidError)
export class AuthErrorFilter implements ExceptionFilter {
  catch(
    exception: RefreshConflictError | RefreshTokenInvalidError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const body = exception.getResponse() as {
      error: string;
      message: string;
    };
    ctx.getResponse<Response>().status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      error: body.error,
      message: body.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}
