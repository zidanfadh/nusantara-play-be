import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole, UserStatus } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, updateUserDto, user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN_KPOTI)
  findAll(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('daerah_id') daerah_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      role,
      status,
      daerah_id,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_KPOTI)
  async getStats() {
    const total = await this.usersService.count();
    return { total };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN_KPOTI)
  updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.updateRole(id, updateRoleDto.role, user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_KPOTI)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @CurrentUser() user: User,
  ) {
    return this.usersService.updateStatus(id, status, user.id);
  }
}
