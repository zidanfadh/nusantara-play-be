import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { User, UserRole } from '../users/entities/user.entity';
import { AdminAdjustDto } from './dto/rewards.dto';
import { AdminAdjustResult, RewardsService } from './rewards.service';

/** /api/admin/rewards (Phase 15), admin_kpoti only, audited. */
@Controller('admin/rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  /** Compensating ADMIN_ADJUST ledger row; reason required (min 5 characters). */
  @Post('adjust')
  @HttpCode(200)
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  adjust(
    @CurrentUser() admin: User,
    @Body() dto: AdminAdjustDto,
  ): Promise<AdminAdjustResult> {
    return this.rewards.adjust(admin.id, dto);
  }
}
