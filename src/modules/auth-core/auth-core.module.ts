import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserCredential } from './entities/user-credential.entity';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { JwksController } from './jwks.controller';
import { LocalAuthController } from './local-auth.controller';
import { LocalAuthService } from './local-auth.service';
import { LoginEmailLimiter } from './login-email-limiter.service';
import { KeyService } from './key.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalJwtStrategy } from './strategies/local-jwt.strategy';
import { TokenService } from './token.service';

/**
 * Self-hosted auth core (Phase 07): passwords, access tokens, refresh
 * tokens, JWKS and the `local-jwt` passport strategy. No dependency on
 * Supabase, so the legacy path in src/modules/auth/legacy/ can later be
 * deleted without touching this module. Since Phase 08 also the register,
 * login, refresh, logout and logout-all endpoints (LocalAuthController).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCredential,
      RefreshToken,
      AuthIdentity,
    ]),
  ],
  controllers: [JwksController, LocalAuthController],
  providers: [
    KeyService,
    TokenService,
    PasswordService,
    RefreshTokenService,
    LocalJwtStrategy,
    LocalAuthService,
    LoginEmailLimiter,
    CsrfGuard,
  ],
  exports: [
    KeyService,
    TokenService,
    PasswordService,
    RefreshTokenService,
    LocalAuthService,
    CsrfGuard,
  ],
})
export class AuthCoreModule {}
