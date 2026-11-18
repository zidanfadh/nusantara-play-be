import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/entities/user.entity';
import { LOCAL_JWT_STRATEGY } from '../auth-core.constants';
import { TokenService } from '../token.service';
import { BearerTokenStrategy } from './bearer-token.strategy';

/**
 * Passport strategy for our own RS256 access tokens (Phase 07).
 *
 * Verifies signature, kid, iss, aud and exp (TokenService), loads the user
 * by id and rejects unknown, suspended and inactive users. One read-only
 * query per request: no Supabase call and no database write.
 *
 * Any token it cannot accept (including every token while local auth is
 * disabled) is a plain failure, so JwtAuthGuard can fall back to the legacy
 * Supabase strategy.
 */
@Injectable()
export class LocalJwtStrategy extends PassportStrategy(
  BearerTokenStrategy,
  LOCAL_JWT_STRATEGY,
) {
  constructor(
    private readonly tokenService: TokenService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super();
  }

  async validate(token: string): Promise<User | null> {
    if (!this.tokenService.isEnabled()) {
      return null;
    }
    let userId: string;
    try {
      userId = (await this.tokenService.verifyAccessToken(token)).sub;
    } catch {
      return null;
    }
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }
    return user;
  }
}
