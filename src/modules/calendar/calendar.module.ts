import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarInviteService } from './calendar-invite.service';
import { CalendarItem } from './entities/calendar-item.entity';
import { CalendarInvite } from './entities/calendar-invite.entity';
import { EventsModule } from '../events/events.module';
import { DaerahModule } from '../daerah/daerah.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([CalendarItem, CalendarInvite]),
        EventsModule,
        DaerahModule,
    ],
    controllers: [CalendarController],
    providers: [CalendarService, CalendarInviteService],
    exports: [CalendarService, CalendarInviteService],
})
export class CalendarModule { }
