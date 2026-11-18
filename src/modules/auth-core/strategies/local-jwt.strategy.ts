import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/entities/user.entity';
import { LOCAL_JWT_STRATEGY } from '../auth-core.constants';
import { attachAuthState, loadUserWithAuthState } from '../email-verification';
import { TokenService } from '../token.service';
import { BearerTokenStrategy } from './bearer-token.strategy';

/**
 * Clock skew allowed between a token's iat (whole seconds, app clock) and
 * user_credentials.password_changed_at (Phase 09). A token issued up to this
 * long before the password change is still accepted; it also covers iat
 * being rounded down to the second.
 */
export const PASSWORD_CHANGE_SKEW_MS = 5_000;

/**
 * Passport strategy for our own RS256 access tokens (Phase 07).
 *
 * Verifies signature, kid, iss, aud and exp (TokenService), loads the user by
 * id and rejects unknown, suspended and inactive users. Since Phase 09 it
 * also rejects a token issued before the user's last password change
 * (iat < password_changed_at - PASSWORD_CHANGE_SKEW_MS). The user, the
 * password change time and "email verified" come from ONE read-only query
 * (users LEFT JOIN user_credentials LEFT JOIN email_verifications); the auth
 * state is attached to the user under a symbol (never serialized). No
 * Supabase call and no database write.
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
    let claims: { sub: string; iat: number };
    try {
      claims = await this.tokenService.verifyAccessToken(token);
    } catch {
      return null;
    }
    const loaded = await loadUserWithAuthState(this.users, claims.sub);
    if (!loaded || loaded.user.status !== UserStatus.ACTIVE) {
      return null;
    }
    const changedAt = loaded.state.passwordChangedAt;
    if (
      changedAt &&
      claims.iat * 1000 < changedAt.getTime() - PASSWORD_CHANGE_SKEW_MS
    ) {
      return null;
    }
    return attachAuthState(loaded.user, loaded.state);
  }
}
