import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import passport from 'passport';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { readAuthConfig } from '../../config/auth.config';
import { LOCAL_JWT_STRATEGY } from '../../modules/auth-core/auth-core.constants';
import { SUPABASE_JWT_STRATEGY } from '../../modules/auth/legacy/supabase-jwt.strategy';

/**
 * Passport strategies in the order JwtAuthGuard tries them (Phase 07):
 * our RS256 tokens first, then (only while AUTH_ACCEPT_SUPABASE_TOKENS is
 * true) the legacy Supabase tokens.
 */
export function jwtAuthStrategies(acceptSupabaseTokens: boolean): string[] {
  return acceptSupabaseTokens
    ? [LOCAL_JWT_STRATEGY, SUPABASE_JWT_STRATEGY]
    : [LOCAL_JWT_STRATEGY];
}

/**
 * Global auth guard (registered first in app.module.ts, before
 * UserThrottlerGuard, which needs req.user).
 *
 * - Protected routes: the first strategy that accepts the bearer token sets
 *   req.user; otherwise 401 (a strategy error is rethrown as before).
 * - @Public() routes: authentication is attempted but never required;
 *   req.user is the user, or `false` without a valid token, exactly as with
 *   the previous AuthGuard('jwt') (errors leave req.user unset).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  readonly strategies: string[];

  constructor(
    private reflector: Reflector,
    @Optional() configService?: ConfigService,
  ) {
    const { acceptSupabaseTokens } = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
    this.strategies = jwtAuthStrategies(acceptSupabaseTokens);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    // Written through a plain record: the property is typed by passport.
    const target = request as unknown as Record<string, unknown>;
    const response = http.getResponse<Response>();

    let user: unknown;
    try {
      user = await this.authenticate(request, response);
    } catch (err) {
      if (isPublic) {
        // Ignore auth errors for public routes; req.user stays unset.
        return true;
      }
      throw err;
    }

    if (isPublic) {
      target.user = user;
      return true;
    }

    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug('Authentication failed on a protected route');
      }
      throw new UnauthorizedException('Authentication required');
    }

    target.user = user;
    return true;
  }

  /** Runs the strategies in order; resolves the user or false. */
  private authenticate(request: Request, response: Response): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const middleware = passport.authenticate(
        this.strategies,
        { session: false },
        (err: unknown, user: unknown, info: unknown) => {
          (request as unknown as Record<string, unknown>).authInfo = info;
          if (err) {
            reject(
              err instanceof Error ? err : new Error('Authentication error'),
            );
          } else {
            resolve(user);
          }
        },
      ) as (req: Request, res: Response, next: (err?: unknown) => void) => void;
      middleware(request, response, (err?: unknown) =>
        err
          ? reject(
              err instanceof Error ? err : new Error('Authentication error'),
            )
          : resolve(false),
      );
    });
  }
}
