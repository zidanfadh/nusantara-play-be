import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { REWARD_CURRENCIES } from '../entities/reward-ledger-entry.entity';
import type { RewardCurrency } from '../entities/reward-ledger-entry.entity';
import {
  ADMIN_ADJUST_MAX_ABS_AMOUNT,
  ADMIN_ADJUST_REASON_MAX_LENGTH,
  ADMIN_ADJUST_REASON_MIN_LENGTH,
  BROWSER_ACTIVITY_TYPES,
  LEDGER_PAGE_LIMIT_DEFAULT,
  LEDGER_PAGE_LIMIT_MAX,
} from '../rewards.rules';
import type { BrowserActivityType } from '../rewards.rules';

/** POST /api/rewards/activities. Any other type -> 400. */
export class RecordActivityDto {
  @IsString()
  @IsIn(BROWSER_ACTIVITY_TYPES, {
    message: `type must be one of: ${BROWSER_ACTIVITY_TYPES.join(', ')}`,
  })
  type: BrowserActivityType;

  /** Province code (PROVINCE_ENTER) or PROT id (PROT_VIEW); checked in the service. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  refId: string;
}

/** GET /api/rewards/me/ledger */
export class LedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LEDGER_PAGE_LIMIT_MAX)
  limit: number = LEDGER_PAGE_LIMIT_DEFAULT;
}

export const LEADERBOARD_SCOPES = ['national', 'province'] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

/** GET /api/rewards/leaderboard */
export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(LEADERBOARD_SCOPES)
  scope: LeaderboardScope = 'national';

  /** Required for scope=province (checked in the service). */
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'provinsiKode must be a two-digit code' })
  provinsiKode?: string;
}

/** POST /api/admin/rewards/adjust (admin_kpoti only). */
export class AdminAdjustDto {
  @IsUUID()
  userId: string;

  @IsIn(REWARD_CURRENCIES)
  currency: RewardCurrency;

  @IsInt()
  @NotEquals(0)
  @Min(-ADMIN_ADJUST_MAX_ABS_AMOUNT)
  @Max(ADMIN_ADJUST_MAX_ABS_AMOUNT)
  amount: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(ADMIN_ADJUST_REASON_MIN_LENGTH)
  @MaxLength(ADMIN_ADJUST_REASON_MAX_LENGTH)
  reason: string;
}
