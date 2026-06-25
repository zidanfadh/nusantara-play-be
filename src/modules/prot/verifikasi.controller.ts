import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { VerifikasiService } from './verifikasi.service';
import { PROTService } from './prot.service';
import { VerifikasiReviewDto } from './dto/verifikasi-review.dto';
import { PublishProtDto } from './dto/publish-prot.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('verifikasi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerifikasiController {
  constructor(
    private readonly verifikasiService: VerifikasiService,
    private readonly protService: PROTService,
  ) {}

  // PAKAR & ADMIN ENDPOINTS (Admin can also access Pakar endpoints)

  @Get('queue')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  async getAvailableQueue(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('provinsi') provinsi?: string,
  ) {
    return this.verifikasiService.getAvailableQueue(page, limit, user, provinsi);
  }

  @Get('my-queue')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  async getMyQueue(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.verifikasiService.getMyQueue(user.id, page, limit);
  }

  @Post('queue/:queueId/pick')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  @UseInterceptors(AuditInterceptor)
  async pickFromQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: User,
  ) {
    return this.verifikasiService.pickFromQueue(queueId, user.id, user);
  }

  @Post('queue/:queueId/release')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  @UseInterceptors(AuditInterceptor)
  async releaseFromQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: User,
  ) {
    return this.verifikasiService.releaseFromQueue(queueId, user.id);
  }

  @Post(':protId/review')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  @UseInterceptors(AuditInterceptor)
  async submitReview(
    @Param('protId') protId: string,
    @CurrentUser() user: User,
    @Body() reviewDto: VerifikasiReviewDto,
  ) {
    return this.verifikasiService.submitReview(protId, user.id, reviewDto, user);
  }

  @Get(':protId/history')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  async getVerifikasiHistory(@Param('protId') protId: string) {
    return this.verifikasiService.getVerifikasiHistory(protId);
  }

  // ADMIN ONLY ENDPOINTS

  @Post('prot/:protId/publish')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async publishToArsipNasional(
    @Param('protId') protId: string,
    @CurrentUser() user: User,
    @Body() publishDto: PublishProtDto,
  ) {
    return this.protService.publishToArsipNasional(protId, user.id);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_KPOTI)
  async getVerifikasiStats() {
    return this.verifikasiService.getVerifikasiStats();
  }
}
