import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import {
  AdminMoveToRevisiDto,
  AdminRemoveMediaDto,
} from './dto/admin-prot.dto';
import {
  AdminMediaRemovalResult,
  AdminMoveToRevisiResult,
  ProtAdminService,
} from './prot-admin.service';

/**
 * /api/admin/prot (Phase 25), admin_kpoti only. The service writes its own audit_logs row (inside the same
 * transaction as the change), so the generic AuditInterceptor is not used here.
 */
@Controller('admin/prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminProtController {
  constructor(private readonly protAdmin: ProtAdminService) {}

  /** Removes one media item (by its exact URL) from a record in any status; deletes our S3 object. */
  @Post(':id/media/remove')
  @HttpCode(200)
  @Roles(UserRole.ADMIN_KPOTI)
  removeMedia(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: User,
    @Body() dto: AdminRemoveMediaDto,
  ): Promise<AdminMediaRemovalResult> {
    return this.protAdmin.removeMedia(id, admin, dto);
  }

  /** Moves an ARSIP_NASIONAL or DIVERIFIKASI record back to REVISI (unpublish for correction). */
  @Post(':id/revisi')
  @HttpCode(200)
  @Roles(UserRole.ADMIN_KPOTI)
  moveToRevisi(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: User,
    @Body() dto: AdminMoveToRevisiDto,
  ): Promise<AdminMoveToRevisiResult> {
    return this.protAdmin.moveToRevisi(id, admin, dto);
  }
}
