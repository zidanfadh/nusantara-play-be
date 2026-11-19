import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardBalance } from './entities/reward-balance.entity';
import { RewardLedgerEntry } from './entities/reward-ledger-entry.entity';
import { UserProtView } from './entities/user-prot-view.entity';
import { UserProvinceStamp } from './entities/user-province-stamp.entity';
import { REWARD_RULES } from './rewards.rules';
import { REWARD_RULES_TOKEN, RewardsService } from './rewards.service';

/**
 * Rewards (Phase 15): XP and Points ledger, balances, PROT views, Paspor
 * stamps. RewardsService is the only place where XP and Points change.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RewardLedgerEntry,
      RewardBalance,
      UserProtView,
      UserProvinceStamp,
    ]),
  ],
  providers: [
    RewardsService,
    { provide: REWARD_RULES_TOKEN, useValue: REWARD_RULES },
  ],
  exports: [RewardsService],
})
export class RewardsModule {}
