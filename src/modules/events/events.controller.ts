import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { EventRegistrationsService } from './event-registrations.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventFilterDto } from './dto/event-filter.dto';
import { RegisterEventDto } from './dto/event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditInterceptor } from '../audit/audit.interceptor';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly registrationsService: EventRegistrationsService,
  ) {}

  @Post()
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async create(@Body() createEventDto: CreateEventDto, @CurrentUser() user: User) {
    return this.eventsService.create(createEventDto, user.id);
  }

  @Get()
  @Public()
  async findAll(@Query() filter: EventFilterDto, @CurrentUser() user?: User) {
    return this.eventsService.findAll(filter, user);
  }

  @Get('my-events')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  async getMyEvents(@CurrentUser() user: User, @Query() filter: EventFilterDto) {
    // For my events, we need to filter by created_by
    const result = await this.eventsService.findAll(filter, user);
    // Filter the results to only show user's own events
    result.data = result.data.filter((e) => e.created_by === user.id);
    result.pagination.total = result.data.length;
    return result;
  }

  @Get('my-registrations')
  async getMyRegistrations(@CurrentUser() user: User) {
    return this.registrationsService.getUserRegistrations(user.id);
  }

  @Get('featured')
  @Public()
  async getFeatured(@Query() filter: EventFilterDto) {
    return this.eventsService.findAll({ ...filter, sortBy: 'created_at', sortOrder: 'DESC' });
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.eventsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: User,
  ) {
    return this.eventsService.update(id, updateEventDto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.eventsService.remove(id, user.id, user.role);
    return { message: 'Event deleted successfully' };
  }

  @Patch(':id/publish')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async publish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.publish(id, user.id, user.role);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.cancel(id, user.id, user.role);
  }

  @Post(':id/register')
  async register(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() data?: RegisterEventDto,
  ) {
    return this.registrationsService.register(id, user.id, data);
  }

  @Delete(':id/register')
  async cancelRegistration(@Param('id') id: string, @CurrentUser() user: User) {
    await this.registrationsService.cancelRegistration(id, user.id);
    return { message: 'Registration cancelled successfully' };
  }

  @Get(':id/registrations')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  async getRegistrations(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.getRegistrations(id, user.id, user.role);
  }

  @Patch(':id/registrations/:userId/check-in')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async checkIn(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    return this.registrationsService.checkIn(id, userId, user.id);
  }

  @Patch(':id/registrations/:userId/undo-check-in')
  @Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async undoCheckIn(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    return this.registrationsService.undoCheckIn(id, userId, user.id);
  }
}
