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
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { toUserViewFor } from './user-views';

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
  async findAll(
    @CurrentUser() viewer: User,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('daerah_id') daerah_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.usersService.findAll({
      role,
      status,
      daerah_id,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      ...result,
      data: result.data.map((user) => toUserViewFor(viewer, user)),
    };
  }

  @Post()
  @Roles(UserRole.ADMIN_KPOTI)
  async create(
    @Body() createUserDto: AdminCreateUserDto,
    @CurrentUser() user: User,
  ) {
    const created = await this.usersService.createByAdmin(
      createUserDto,
      user.id,
    );
    return toUserViewFor(user, created);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_KPOTI)
  async getStats() {
    const total = await this.usersService.count();
    return { total };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  async findOne(@Param('id') id: string, @CurrentUser() viewer: User) {
    return toUserViewFor(viewer, await this.usersService.findById(id));
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN_KPOTI)
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: User,
  ) {
    const updated = await this.usersService.updateRole(
      id,
      updateRoleDto.role,
      user.id,
      updateRoleDto.daerah_id,
    );
    return toUserViewFor(user, updated);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_KPOTI)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @CurrentUser() user: User,
  ) {
    const updated = await this.usersService.updateStatus(id, status, user.id);
    return toUserViewFor(user, updated);
  }
}
