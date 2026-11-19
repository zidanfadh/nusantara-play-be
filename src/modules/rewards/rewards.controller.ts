import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  LeaderboardQueryDto,
  LedgerQueryDto,
  RecordActivityDto,
} from './dto/rewards.dto';
import {
  LeaderboardView,
  LedgerItem,
  Paginated,
  PasporView,
  RewardsMe,
  RewardsQueryService,
} from './rewards-query.service';
import { ACTIVITY_THROTTLE } from './rewards.rules';
import { GrantResult, RewardsService } from './rewards.service';

/**
 * /api/rewards (Phase 15). Login required (any role); the global
 * JwtAuthGuard accepts local tokens and legacy Supabase tokens.
 */
@Controller('rewards')
export class RewardsController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly queries: RewardsQueryService,
  ) {}

  /**
   * A browser-reported action. XP only, never Points; the server validates
   * the reference and decides the reward. 60 requests / minute per user.
   */
  @Post('activities')
  @HttpCode(200)
  @Throttle({ default: ACTIVITY_THROTTLE })
  recordActivity(
    @CurrentUser() user: User,
    @Body() dto: RecordActivityDto,
  ): Promise<GrantResult> {
    return this.rewards.recordActivity(user.id, dto.type, dto.refId);
  }

  @Get('me')
  getMe(@CurrentUser() user: User): Promise<RewardsMe> {
    return this.queries.getMe(user.id);
  }

  @Get('me/ledger')
  getLedger(
    @CurrentUser() user: User,
    @Query() query: LedgerQueryDto,
  ): Promise<Paginated<LedgerItem>> {
    return this.queries.getLedger(user.id, query.page, query.limit);
  }

  @Get('me/paspor')
  getPaspor(@CurrentUser() user: User): Promise<PasporView> {
    return this.queries.getPaspor(user.id);
  }

  @Get('leaderboard')
  getLeaderboard(
    @CurrentUser() user: User,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardView> {
    return this.queries.getLeaderboard(
      user.id,
      query.scope,
      query.provinsiKode,
    );
  }
}
