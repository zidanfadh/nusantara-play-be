import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthCleanupScheduler } from './auth-cleanup.scheduler';
import { AuthTokenService } from './auth-token.service';
import { EmailFlowsController } from './email-flows.controller';
import { EmailFlowsService } from './email-flows.service';
import { EmailSendLimiter } from './email-send-limiter.service';
import { AuthToken } from './entities/auth-token.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserCredential } from './entities/user-credential.entity';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { JwksController } from './jwks.controller';
import { LocalAuthController } from './local-auth.controller';
import { LocalAuthService } from './local-auth.service';
import { LoginEmailLimiter } from './login-email-limiter.service';
import { LoginFailureTracker } from './login-failure-tracker.service';
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
 * Since Phase 09: email verification and password reset
 * (EmailFlowsController, EmailFlowsService, AuthTokenService), the
 * per-address email limit and the daily token cleanup.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCredential,
      RefreshToken,
      AuthIdentity,
      AuthToken,
      EmailVerification,
    ]),
    // EmailService for the Phase 09 emails.
    NotificationsModule,
  ],
  controllers: [JwksController, LocalAuthController, EmailFlowsController],
  providers: [
    KeyService,
    TokenService,
    PasswordService,
    RefreshTokenService,
    LocalJwtStrategy,
    LocalAuthService,
    LoginEmailLimiter,
    LoginFailureTracker,
    CsrfGuard,
    AuthTokenService,
    EmailSendLimiter,
    EmailFlowsService,
    AuthCleanupScheduler,
  ],
  exports: [
    AuthTokenService,
    EmailFlowsService,
    KeyService,
    TokenService,
    PasswordService,
    RefreshTokenService,
    LocalAuthService,
    CsrfGuard,
  ],
})
export class AuthCoreModule {}
