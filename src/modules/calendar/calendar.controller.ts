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
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarInviteService } from './calendar-invite.service';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { CreatePersonalScheduleDto } from './dto/create-personal-schedule.dto';
import { UpdateCalendarItemDto } from './dto/update-calendar-item.dto';
import { CalendarFilterDto } from './dto/calendar-filter.dto';
import { AgendaFilterDto } from './dto/agenda-filter.dto';
import { InviteUsersDto } from './dto/invite-users.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
    constructor(
        private readonly calendarService: CalendarService,
        private readonly inviteService: CalendarInviteService,
    ) { }

    // ─── Calendar Views ──────────────────────────────────────────

    @Get()
    @Public()
    async getCalendar(@Query() filter: CalendarFilterDto, @CurrentUser() user?: User) {
        return this.calendarService.getCalendar(filter, user);
    }

    @Get('agenda')
    @Public()
    async getAgenda(@Query() filter: AgendaFilterDto, @CurrentUser() user?: User) {
        return this.calendarService.getAgenda(filter, user);
    }

    // ─── Important Dates ──────────────────────────────────────────

    @Post('important-dates')
    @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
    async createImportantDate(
        @Body() dto: CreateImportantDateDto,
        @CurrentUser() user: User,
    ) {
        return this.calendarService.createImportantDate(dto, user);
    }

    @Get('important-dates')
    @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
    async getImportantDates(@CurrentUser() user: User) {
        return this.calendarService.getImportantDates(user);
    }

    @Patch('important-dates/:id')
    @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
    async updateImportantDate(
        @Param('id') id: string,
        @Body() dto: UpdateCalendarItemDto,
        @CurrentUser() user: User,
    ) {
        return this.calendarService.update(id, dto, user);
    }

    @Delete('important-dates/:id')
    @Roles(UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
    async deleteImportantDate(@Param('id') id: string, @CurrentUser() user: User) {
        await this.calendarService.remove(id, user);
        return { message: 'Important date deleted successfully' };
    }

    // ─── Personal Schedule ──────────────────────────────────────────

    @Post('personal-schedule')
    async createPersonalSchedule(
        @Body() dto: CreatePersonalScheduleDto,
        @CurrentUser() user: User,
    ) {
        return this.calendarService.createPersonalSchedule(dto, user);
    }

    @Get('personal-schedule')
    async getMyPersonalSchedule(@CurrentUser() user: User) {
        return this.calendarService.getMyPersonalSchedule(user.id);
    }

    @Patch('personal-schedule/:id')
    async updatePersonalSchedule(
        @Param('id') id: string,
        @Body() dto: UpdateCalendarItemDto,
        @CurrentUser() user: User,
    ) {
        return this.calendarService.update(id, dto, user);
    }

    @Delete('personal-schedule/:id')
    async deletePersonalSchedule(@Param('id') id: string, @CurrentUser() user: User) {
        await this.calendarService.remove(id, user);
        return { message: 'Personal schedule deleted successfully' };
    }

    // ─── Detail ──────────────────────────────────────────

    @Get(':id')
    @Public()
    async getOne(@Param('id') id: string, @CurrentUser() user?: User) {
        return this.calendarService.getOne(id, user);
    }

    // ─── Invites (Owner) ──────────────────────────────────────────

    @Post(':id/invites')
    async inviteUsers(
        @Param('id') id: string,
        @Body() dto: InviteUsersDto,
        @CurrentUser() user: User,
    ) {
        return this.inviteService.inviteUsers(id, dto.user_ids, user);
    }

    @Get(':id/invites')
    async getItemInvites(@Param('id') id: string, @CurrentUser() user: User) {
        return this.inviteService.getInvitesForItem(id, user);
    }

    @Delete(':id/invites/:userId')
    async removeInvite(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @CurrentUser() user: User,
    ) {
        await this.inviteService.removeInvite(id, userId, user);
        return { message: 'Invite removed successfully' };
    }

    // ─── My Invites (Invited User) ──────────────────────────────────────

    @Get('invites/my')
    async getMyInvites(@CurrentUser() user: User) {
        return this.inviteService.getMyInvites(user.id);
    }

    @Patch('invites/:inviteId')
    async updateInviteStatus(
        @Param('inviteId') inviteId: string,
        @Body() dto: UpdateInviteDto,
        @CurrentUser() user: User,
    ) {
        return this.inviteService.updateInviteStatus(inviteId, dto.status, user.id);
    }
}
