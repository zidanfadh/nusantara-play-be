import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public routes, try to authenticate but don't require it
      try {
        await super.canActivate(context);
      } catch (err) {
        // Ignore auth errors for public routes
        // User will be undefined in the request
      }
      return true; // Always allow access
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err, user, info, context) {
    const request = context?.switchToHttp?.()?.getRequest?.();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Only log errors on protected routes in non-production
    if (process.env.NODE_ENV !== 'production' && !isPublic && (err || !user)) {
      console.log('[JwtAuthGuard] handleRequest - err:', err?.message, 'user:', user?.id, user?.role, 'info:', info?.message);
    }

    // For public routes, return user if available (can be undefined)
    if (isPublic) {
      return user; // undefined jika tidak ada token, atau user object jika ada
    }

    // For protected routes, user must exist
    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}