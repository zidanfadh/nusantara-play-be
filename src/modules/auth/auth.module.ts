import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { supabaseJwtStrategyProvider } from './legacy/supabase-jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { SupabaseModule } from '../supabase';
import { AuthCoreModule } from '../auth-core/auth-core.module';
import { LOCAL_JWT_STRATEGY } from '../auth-core/auth-core.constants';

// Phase 08: the JwtModule configured with SUPABASE_JWT_SECRET was removed;
// nothing injected JwtService (Supabase tokens are verified through JWKS by
// the legacy strategy, our own tokens by auth-core's TokenService).
@Module({
  imports: [
    UsersModule,
    AuditModule,
    SupabaseModule,
    // LocalAuthService + CsrfGuard for the local change-password (Phase 08).
    AuthCoreModule,
    PassportModule.register({ defaultStrategy: LOCAL_JWT_STRATEGY }),
  ],
  controllers: [AuthController],
  // Legacy Supabase strategy, only when AUTH_ACCEPT_SUPABASE_TOKENS is true.
  providers: [AuthService, supabaseJwtStrategyProvider],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
