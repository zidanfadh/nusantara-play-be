import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('supabase.jwtSecret');

    if (!jwtSecret) {
      throw new Error(
        'Missing Supabase JWT Secret: SUPABASE_JWT_SECRET is required',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      audience: 'authenticated',
    });
  }

  async validate(payload: JwtPayload) {
    // Payload from Supabase JWT contains 'sub' which is the supabase user id
    const supabaseUserId = payload.sub;

    // Find or create user in our database (JIT sync)
    let user = await this.usersService.findBySupabaseId(supabaseUserId);

    if (!user) {
      // First time login - create user with default role
      user = await this.usersService.createFromSupabase({
        supabase_user_id: supabaseUserId,
        email: payload.email,
        full_name: payload.email.split('@')[0], // Use email prefix as default name
      });
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Return user object which will be attached to request.user
    return user;
  }
}
