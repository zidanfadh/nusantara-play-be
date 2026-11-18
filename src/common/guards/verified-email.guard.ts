import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { resolveEmailVerified } from '../../modules/auth-core/email-verification';

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** 403 { code: "EMAIL_NOT_VERIFIED" } (Phase 09). */
export class EmailNotVerifiedException extends ForbiddenException {
  readonly code = EMAIL_NOT_VERIFIED;

  constructor() {
    super({
      statusCode: 403,
      code: EMAIL_NOT_VERIFIED,
      message: 'Verify your email address to use this feature',
    });
  }
}

/**
 * Keeps `code` in the body (the global HttpExceptionFilter keeps only
 * `message`). Registered on the route by @RequireVerifiedEmail().
 */
@Catch(EmailNotVerifiedException)
export class EmailNotVerifiedFilter implements ExceptionFilter {
  catch(exception: EmailNotVerifiedException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const body = exception.getResponse() as { code: string; message: string };
    ctx.getResponse<Response>().status(403).json({
      statusCode: 403,
      code: body.code,
      message: body.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}

/**
 * Requires a verified email (Phase 09; Points will use it). Runs after the
 * global JwtAuthGuard: reads the state the local-jwt strategy attached to
 * req.user (no query), or makes one query for legacy Supabase users.
 * Unauthenticated -> 401; unverified -> 403 EMAIL_NOT_VERIFIED.
 * Use through @RequireVerifiedEmail().
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: unknown }>().user;
    if (!user || typeof user !== 'object' || !('id' in user)) {
      throw new UnauthorizedException('Authentication required');
    }
    const verified = await resolveEmailVerified(
      this.dataSource,
      user as { id: string },
    );
    if (!verified) {
      throw new EmailNotVerifiedException();
    }
    return true;
  }
}
