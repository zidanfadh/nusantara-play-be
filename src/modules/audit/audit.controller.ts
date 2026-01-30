import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin_kpoti')
  async findAll(
    @Query('user_id') user_id?: string,
    @Query('entity_type') entity_type?: string,
    @Query('entity_id') entity_id?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const logs = await this.auditService.findAll({
      user_id,
      entity_type,
      entity_id,
      action,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await this.auditService.count({
      user_id,
      entity_type,
      entity_id,
    });

    return {
      data: logs,
      total,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    };
  }

  @Get('entity/:type/:id')
  @Roles('admin_kpoti', 'pakar')
  findByEntity(@Param('type') type: string, @Param('id') id: string) {
    return this.auditService.findByEntity(type, id);
  }

  @Get('user/:id')
  @Roles('admin_kpoti')
  findByUser(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.auditService.findByUser(id, limit ? parseInt(limit, 10) : 50);
  }
}
