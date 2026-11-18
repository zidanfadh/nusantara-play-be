/**
 * LEGACY auth path (Supabase tokens). Phase 07 isolated it here so a later
 * phase can delete src/modules/auth/legacy/ in one step.
 *
 * Active only while AUTH_ACCEPT_SUPABASE_TOKENS is true (default): the
 * provider below returns null otherwise, so the strategy is never
 * registered with passport. Behavior is unchanged from before Phase 07,
 * except that the strategy is now named 'supabase-jwt' (was the
 * passport-jwt default 'jwt') and the sync error is logged through the Nest
 * Logger (error name only) instead of console.error.
 */
import { Injectable, Logger, Provider } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { SupabaseService } from '../../supabase';
import { readAuthConfig } from '../../../config/auth.config';
import jwksRsa from 'jwks-rsa';

export const SUPABASE_JWT_STRATEGY = 'supabase-jwt';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  SUPABASE_JWT_STRATEGY,
) {
  private readonly logger = new Logger(SupabaseJwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private supabaseService: SupabaseService,
  ) {
    const supabaseUrl = configService.get<string>('supabase.url');

    if (!supabaseUrl) {
      throw new Error('Missing Supabase URL: SUPABASE_URL is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
      audience: 'authenticated',
      algorithms: ['ES256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Payload from Supabase JWT contains 'sub' which is the supabase user id
    const supabaseUserId = payload.sub;

    let user = await this.usersService.findBySupabaseId(supabaseUserId);

    try {
      // Fetch complete user data from Supabase
      const supabaseUser =
        await this.supabaseService.fetchUserById(supabaseUserId);
      user = await this.usersService.syncFromSupabase(supabaseUser);
    } catch (error) {
      // Fallback: use existing local data or create minimal user
      if (!user) {
        user = await this.usersService.createFromSupabase({
          supabase_user_id: supabaseUserId,
          email: payload.email,
          full_name: payload.email.split('@')[0],
        });
      }
      // Log error but don't block login (no personal data in logs)
      this.logger.warn(
        `Failed to sync user from Supabase, using local data (${(error as Error)?.name ?? 'Error'})`,
      );
    }

    await this.usersService.updateLastLogin(user.id);

    return user;
  }
}

/**
 * Registers SupabaseJwtStrategy only when AUTH_ACCEPT_SUPABASE_TOKENS is
 * true. When false, nothing is constructed and passport never knows the
 * 'supabase-jwt' name (JwtAuthGuard does not ask for it either).
 */
export const supabaseJwtStrategyProvider: Provider = {
  provide: SupabaseJwtStrategy,
  inject: [ConfigService, UsersService, SupabaseService],
  useFactory: (
    configService: ConfigService,
    usersService: UsersService,
    supabaseService: SupabaseService,
  ): SupabaseJwtStrategy | null => {
    const { acceptSupabaseTokens } = readAuthConfig((key) =>
      configService.get<string>(key),
    );
    if (!acceptSupabaseTokens) {
      new Logger('SupabaseJwtStrategy').log(
        'AUTH_ACCEPT_SUPABASE_TOKENS=false: legacy Supabase tokens are rejected.',
      );
      return null;
    }
    return new SupabaseJwtStrategy(
      configService,
      usersService,
      supabaseService,
    );
  },
};
