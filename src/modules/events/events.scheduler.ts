import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';

@Injectable()
export class EventsScheduler {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateEventStatuses(): Promise<void> {
    const now = new Date();

    // Update published -> ongoing when start time reached
    await this.eventRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.ONGOING })
      .where({
        status: EventStatus.PUBLISHED,
        tanggal_mulai: LessThanOrEqual(now),
      })
      .execute();

    // Update ongoing -> completed when end time reached
    await this.eventRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.COMPLETED })
      .where({
        status: EventStatus.ONGOING,
        tanggal_selesai: LessThanOrEqual(now),
      })
      .execute();
  }
}
