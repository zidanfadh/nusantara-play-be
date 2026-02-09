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

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public routes, activate auth but don't require it
      // This allows optional authentication
      return super.canActivate(context);
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // For public routes or valid auth, allow the request
    // user will be undefined if no token provided
    console.log('[JwtAuthGuard] handleRequest - err:', err?.message, 'user:', user?.id, user?.role, 'info:', info?.message);
    if (err) {
      throw err;
    }
    return user;
  }
}
