import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventRegistrationsService } from './event-registrations.service';
import { EventsScheduler } from './events.scheduler';
import { Event } from './entities/event.entity';
import { EventRegistration } from './entities/event-registration.entity';
import { DaerahModule } from '../daerah/daerah.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventRegistration]),
    DaerahModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventRegistrationsService, EventsScheduler],
  exports: [EventsService, EventRegistrationsService],
})
export class EventsModule {}
