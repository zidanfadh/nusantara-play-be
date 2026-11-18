import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { supabaseJwtStrategyProvider } from './legacy/supabase-jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { SupabaseModule } from '../supabase';
import { LOCAL_JWT_STRATEGY } from '../auth-core/auth-core.constants';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    SupabaseModule,
    PassportModule.register({ defaultStrategy: LOCAL_JWT_STRATEGY }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('supabase.jwtSecret'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  // Legacy Supabase strategy, only when AUTH_ACCEPT_SUPABASE_TOKENS is true.
  providers: [AuthService, supabaseJwtStrategyProvider],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
