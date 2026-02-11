import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { EventRegistration, RegistrationStatus } from './entities/event-registration.entity';
import { RegisterEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

@Injectable()
export class EventRegistrationsService {
  constructor(
    @InjectRepository(EventRegistration)
    private registrationRepository: Repository<EventRegistration>,
    private eventsService: EventsService,
  ) {}

  async register(eventId: string, userId: string, data?: RegisterEventDto): Promise<EventRegistration> {
    const event = await this.eventsService.findOne(eventId);

    // Check if registration is open
    if (!this.eventsService.isRegistrationOpen(event)) {
      throw new BadRequestException('Registration is closed for this event');
    }

    // Check if already registered
    const existing = await this.registrationRepository.findOne({
      where: { event_id: eventId, user_id: userId },
    });

    if (existing) {
      if (existing.status === RegistrationStatus.CANCELLED) {
        // Re-register cancelled registration
        existing.status = RegistrationStatus.REGISTERED;
        existing.data_pendaftaran = data?.data_pendaftaran || {};
        return this.registrationRepository.save(existing);
      }
      throw new ConflictException('You are already registered for this event');
    }

    // Check quota
    if (event.kuota_peserta) {
      const count = await this.registrationRepository.count({
        where: { event_id: eventId, status: RegistrationStatus.REGISTERED } as any,
      });
      if (count >= event.kuota_peserta) {
        throw new BadRequestException('Event is fully booked');
      }
    }

    const registration = this.registrationRepository.create({
      event_id: eventId,
      user_id: userId,
      data_pendaftaran: data?.data_pendaftaran || {},
      status: RegistrationStatus.REGISTERED,
    });

    const saved = await this.registrationRepository.save(registration);

    // Update event participant count
    await this.updateParticipantCount(eventId);

    return saved;
  }

  async cancelRegistration(eventId: string, userId: string): Promise<void> {
    const registration = await this.registrationRepository.findOne({
      where: { event_id: eventId, user_id: userId },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('Registration is already cancelled');
    }

    if (registration.status === RegistrationStatus.CHECKED_IN) {
      throw new BadRequestException('Cannot cancel registration after check-in');
    }

    registration.status = RegistrationStatus.CANCELLED;
    await this.registrationRepository.save(registration);

    // Update event participant count
    await this.updateParticipantCount(eventId);
  }

  async getUserRegistrations(userId: string): Promise<EventRegistration[]> {
    return this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.event', 'event')
      .leftJoinAndSelect('event.daerah', 'daerah')
      .where('registration.user_id = :userId', { userId })
      .orderBy('registration.created_at', 'DESC')
      .getMany();
  }

  async checkIn(
    eventId: string,
    attendeeUserId: string,
    organizerId: string,
  ): Promise<EventRegistration> {
    const registration = await this.registrationRepository.findOne({
      where: { event_id: eventId, user_id: attendeeUserId },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CHECKED_IN) {
      throw new BadRequestException('Attendee already checked in');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('Cannot check-in cancelled registration');
    }

    registration.status = RegistrationStatus.CHECKED_IN;
    registration.checked_in_at = new Date();
    return this.registrationRepository.save(registration);
  }

  async undoCheckIn(
    eventId: string,
    attendeeUserId: string,
    organizerId: string,
  ): Promise<EventRegistration> {
    const registration = await this.registrationRepository.findOne({
      where: { event_id: eventId, user_id: attendeeUserId },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status !== RegistrationStatus.CHECKED_IN) {
      throw new BadRequestException('Attendee is not checked in');
    }

    registration.status = RegistrationStatus.REGISTERED;
    (registration as any).checked_in_at = null;
    return this.registrationRepository.save(registration);
  }

  private async updateParticipantCount(eventId: string): Promise<void> {
    const count = await this.registrationRepository.count({
      where: { event_id: eventId, status: RegistrationStatus.REGISTERED } as any,
    });

    await this.registrationRepository.manager.update(Event, eventId, {
      jumlah_peserta: count,
    });
  }
}
