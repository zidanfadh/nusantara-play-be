import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { SupabaseService } from '../../supabase';
import jwksRsa from 'jwks-rsa'; // ⭐ Default import

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
      // Log error but don't block login
      console.error(
        'Failed to sync user from Supabase, using local data:',
        error.message,
      );
    }

    await this.usersService.updateLastLogin(user.id);

    return user;
  }
}
