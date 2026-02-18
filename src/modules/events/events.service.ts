import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus, EventJenis } from './entities/event.entity';
import { EventRegistration, RegistrationStatus } from './entities/event-registration.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventFilterDto } from './dto/event-filter.dto';
import { DaerahService } from '../daerah/daerah.service';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(EventRegistration)
    private registrationRepository: Repository<EventRegistration>,
    private daerahService: DaerahService,
  ) {}

  async create(createEventDto: CreateEventDto, createdBy: string): Promise<Event> {
    // Validate daerah exists
    try {
      await this.daerahService.findById(createEventDto.daerah_id);
    } catch {
      throw new BadRequestException(`Invalid daerah_id: ${createEventDto.daerah_id}`);
    }

    // Handle type alias
    const jenis = createEventDto.type || createEventDto.jenis;

    const event = this.eventRepository.create({
      ...createEventDto,
      jenis,
      created_by: createdBy,
      status: EventStatus.DRAFT,
      jumlah_peserta: 0,
    });
    return this.eventRepository.save(event);
  }

  async findAll(
    filter: EventFilterDto,
    user?: User,
  ): Promise<{
    data: Event[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.daerah', 'daerah')
      .leftJoinAndSelect('event.organizer', 'organizer');

    // Handle type alias
    const jenis = filter.type || filter.jenis;

    // Visibility: draft only visible to creator, others to public
    if (!user) {
      queryBuilder.andWhere('event.status != :draftStatus', { draftStatus: EventStatus.DRAFT });
    } else if (user.role === UserRole.PUBLIK) {
      queryBuilder.andWhere('event.status != :draftStatus', { draftStatus: EventStatus.DRAFT });
    } else if (user.role === UserRole.KURATOR_DAERAH) {
      queryBuilder.andWhere('(event.created_by = :userId OR event.status != :draftStatus)', {
        userId: user.id,
        draftStatus: EventStatus.DRAFT,
      });
    }
    // Admin sees all

    if (jenis) {
      queryBuilder.andWhere('event.jenis = :jenis', { jenis });
    }

    if (filter.daerah_id) {
      queryBuilder.andWhere('event.daerah_id = :daerah_id', { daerah_id: filter.daerah_id });
    }

    if (filter.startDate) {
      queryBuilder.andWhere('event.tanggal_mulai >= :startDate', { startDate: filter.startDate });
    }

    if (filter.endDate) {
      queryBuilder.andWhere('event.tanggal_selesai <= :endDate', { endDate: filter.endDate });
    }

    if (filter.status) {
      queryBuilder.andWhere('event.status = :status', { status: filter.status });
    }

    if (filter.search) {
      queryBuilder.andWhere('(event.nama ILIKE :search OR event.deskripsi ILIKE :search)', {
        search: `%${filter.search}%`,
      });
    }

    // Sorting
    const sortBy = filter.sortBy || 'tanggal_mulai';
    const sortOrder = filter.sortOrder || 'ASC';
    queryBuilder.orderBy(`event.${sortBy}`, sortOrder);

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string, user?: User): Promise<Event & { is_registered: boolean }> {
    const event = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.daerah', 'daerah')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .where('event.id = :id', { id })
      .getOne();

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Draft events only visible to creator
    if (event.status === EventStatus.DRAFT && (!user || event.created_by !== user.id)) {
      throw new ForbiddenException('You do not have access to this event');
    }

    let is_registered = false;
    if (user) {
      const registration = await this.registrationRepository.findOne({
        where: { event_id: id, user_id: user.id },
      });
      is_registered = !!registration;
    }

    return { ...event, is_registered };
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    userId: string,
    userRole: UserRole,
  ): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check ownership (kurator can only edit own events, admin can edit all)
    if (userRole === UserRole.KURATOR_DAERAH && event.created_by !== userId) {
      throw new ForbiddenException('You do not have access to edit this event');
    }

    // Can only edit draft events
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException(`Event with status ${event.status} cannot be edited`);
    }

    // Handle type alias
    if (updateEventDto.type) {
      (updateEventDto as any).jenis = updateEventDto.type as any;
    }

    Object.assign(event, updateEventDto);
    return this.eventRepository.save(event);
  }

  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check ownership
    if (userRole === UserRole.KURATOR_DAERAH && event.created_by !== userId) {
      throw new ForbiddenException('You do not have access to delete this event');
    }

    await this.eventRepository.remove(event);
  }

  async publish(id: string, userId: string, userRole: UserRole): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check ownership
    if (userRole === UserRole.KURATOR_DAERAH && event.created_by !== userId) {
      throw new ForbiddenException('You do not have access to publish this event');
    }

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException(`Only draft events can be published`);
    }

    event.status = EventStatus.PUBLISHED;
    event.published_at = new Date();
    return this.eventRepository.save(event);
  }

  async cancel(id: string, userId: string, userRole: UserRole): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check ownership
    if (userRole === UserRole.KURATOR_DAERAH && event.created_by !== userId) {
      throw new ForbiddenException('You do not have access to cancel this event');
    }

    if ([EventStatus.COMPLETED, EventStatus.CANCELLED].includes(event.status)) {
      throw new BadRequestException(`Event with status ${event.status} cannot be cancelled`);
    }

    event.status = EventStatus.CANCELLED;
    return this.eventRepository.save(event);
  }

  async getRegistrations(eventId: string, userId: string, userRole: UserRole): Promise<EventRegistration[]> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Only organizer or admin can view registrations
    if (userRole === UserRole.KURATOR_DAERAH && event.created_by !== userId) {
      throw new ForbiddenException('You do not have access to view registrations for this event');
    }

    return this.registrationRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.user', 'user')
      .where('registration.event_id = :eventId', { eventId })
      .orderBy('registration.created_at', 'ASC')
      .getMany();
  }

  isRegistrationOpen(event: Event): boolean {
    const now = new Date();
    return [EventStatus.PUBLISHED, EventStatus.ONGOING].includes(event.status) &&
      (!event.tanggal_mulai || event.tanggal_mulai > now);
  }
}
