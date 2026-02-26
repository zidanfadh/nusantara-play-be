import { IsEnum } from 'class-validator';
import { CalendarInviteStatus } from '../entities/calendar-invite.entity';

export class UpdateInviteDto {
    @IsEnum(CalendarInviteStatus, {
        message: 'status must be accepted or declined',
    })
    status: CalendarInviteStatus.ACCEPTED | CalendarInviteStatus.DECLINED;
}
