import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CalendarInviteStatus } from '../entities/calendar-invite.entity';

export class ListInvitesDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    /**
     * Filter by invite status.
     * - omit (default): returns all statuses
     * - pending: only pending invites
     * - accepted: only accepted invites
     * - declined: only declined invites
     */
    @IsOptional()
    @IsEnum(CalendarInviteStatus)
    status?: CalendarInviteStatus;
}
