import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Core modules
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { AuthCoreModule } from './modules/auth-core/auth-core.module';
import { UsersModule } from './modules/users/users.module';
import { DaerahModule } from './modules/daerah/daerah.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { PROTModule } from './modules/prot/prot.module';
import { EventsModule } from './modules/events/events.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { NftsModule } from './modules/nfts/nfts.module';
import { StatsModule } from './modules/stats/stats.module';
import { RewardsModule } from './modules/rewards/rewards.module';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';

@Module({
  imports: [
    // Core modules
    ConfigModule,
    DatabaseModule,

    // Scheduling (required for @Cron decorators across all modules)
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),

    // Feature modules
    AuthCoreModule, // self-hosted auth core (Phase 07): 'local-jwt' strategy, JWKS
    AuthModule,
    UsersModule,
    DaerahModule,
    StorageModule,
    AuditModule,
    SupabaseModule,
    PROTModule,
    EventsModule,
    CalendarModule,
    BlockchainModule,
    MarketplaceModule,
    NftsModule,
    StatsModule,
    RewardsModule, // Phase 15: XP and Points ledger
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guards run in the order of these APP_GUARD entries. JwtAuthGuard
    // must come first: it sets req.user, which UserThrottlerGuard uses to
    // track logged-in users by user id (Phase 06, P3). useExisting lets
    // tests replace a guard with overrideProvider().
    JwtAuthGuard,
    UserThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
