# Events Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Events module for Nusantara Play to manage cultural events (teras_bermain, workshop, festival)

**Architecture:** NestJS module with TypeORM entities, following existing patterns from PROT module. Events have draft→published status flow, user registration, check-in system, and manual certificate issuance.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, class-validator, @nestjs/schedule

---

## Prerequisites

**Database Tables Already Exist:**
- `events` table (from 001_initial_schema.sql)
- `event_registrations` table (from 001_initial_schema.sql)
- `certificates` table (from 001_initial_schema.sql)

**Important:** The database schema uses different column names than the design doc. Use the schema column names:
- `nama` (not title)
- `deskripsi` (not description)
- `jenis` (not type)
- `tanggal_mulai` (not startDate)
- `tanggal_selesai` (not endDate)
- `daerah_id` (not daerahId)
- `kuota_peserta` (not maxParticipants)
- `jumlah_peserta` (registration count, computed)
- `banner_url` (not bannerImage)
- `galeri_foto` (not additionalImages)

---

## Task 1: Create Event Entity

**Files:**
- Create: `src/modules/events/entities/event.entity.ts`

**Step 1: Create the event entity**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ValueTransformer,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Daerah } from '../../daerah/entities/daerah.entity';

export enum EventJenis {
  TERAS_BERMAIN = 'teras_bermain',
  WORKSHOP = 'workshop',
  FESTIVAL = 'festival',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

const JsonTransformer: ValueTransformer = {
  to(value: any): any {
    return JSON.stringify(value);
  },
  from(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nama' })
  nama: string;

  @Column({ name: 'deskripsi', type: 'text' })
  deskripsi: string;

  @Column({
    name: 'jenis',
    type: 'enum',
    enum: EventJenis,
  })
  jenis: EventJenis;

  @Column({
    name: 'status',
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ name: 'tanggal_mulai', type: 'timestamp' })
  tanggal_mulai: Date;

  @Column({ name: 'tanggal_selesai', type: 'timestamp' })
  tanggal_selesai: Date;

  @Column({ name: 'lokasi' })
  lokasi: string;

  @Column({ name: 'daerah_id' })
  daerah_id: string;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ name: 'kuota_peserta', nullable: true })
  kuota_peserta: number;

  @Column({ name: 'jumlah_peserta', default: 0 })
  jumlah_peserta: number;

  @Column({ name: 'banner_url', nullable: true })
  banner_url: string;

  @Column({
    name: 'galeri_foto',
    type: 'jsonb',
    nullable: true,
    transformer: JsonTransformer,
  })
  galeri_foto: string[];

  @Column({ name: 'persyaratan', type: 'text', nullable: true })
  persyaratan: string;

  @Column({
    name: 'formulir_custom',
    type: 'jsonb',
    nullable: true,
    transformer: JsonTransformer,
  })
  formulir_custom: Record<string, any>;

  @Column({ name: 'contact_person', nullable: true })
  contact_person: string;

  @Column({ name: 'contact_phone', nullable: true })
  contact_phone: string;

  @Column({ name: 'contact_email', nullable: true })
  contact_email: string;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'created_by' })
  created_by: string;

  @Column({ name: 'updated_by', nullable: true })
  updated_by: string;

  // Relations
  @ManyToOne(() => Daerah, { nullable: false })
  @JoinColumn({ name: 'daerah_id' })
  daerah: Daerah;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  organizer: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User | null;
}
```

**Step 2: Commit**

```bash
git add src/modules/events/entities/event.entity.ts
git commit -m "feat(events): add Event entity

Define Event entity with all required fields for event management.
Uses database schema column names from 001_initial_schema.sql.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create EventRegistration Entity

**Files:**
- Create: `src/modules/events/entities/event-registration.entity.ts`

**Step 1: Create the event registration entity**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from '../../users/entities/user.entity';

export enum RegistrationStatus {
  REGISTERED = 'registered',
  CHECKED_IN = 'checked_in',
  CANCELLED = 'cancelled',
}

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  event_id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @Column({
    name: 'data_pendaftaran',
    type: 'jsonb',
  })
  data_pendaftaran: Record<string, any>;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.REGISTERED,
  })
  status: RegistrationStatus;

  @Column({ name: 'checked_in_at', type: 'timestamp', nullable: true })
  checked_in_at: Date;

  @Column({ name: 'certificate_id', type: 'uuid', nullable: true })
  certificate_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Event, { nullable: false })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

**Step 2: Commit**

```bash
git add src/modules/events/entities/event-registration.entity.ts
git commit -m "feat(events): add EventRegistration entity

Define EventRegistration entity for tracking event attendees
with check-in and certificate support.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create DTOs - CreateEventDto

**Files:**
- Create: `src/modules/events/dto/create-event.dto.ts`

**Step 1: Create the DTO**

```typescript
import { IsString, IsEnum, IsOptional, IsInt, IsEmail, IsObject, IsArray, MinDate, validateSync } from 'class-validator';
import { Type } from 'class-transformer';
import { EventJenis } from '../entities/event.entity';

export class FormulirCustomDto {
  @IsOptional()
  @IsString()
  nama?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telepon?: string;

  @IsOptional()
  @IsString()
  alamat?: string;
}

export class CreateEventDto {
  @IsString()
  nama: string;

  @IsString()
  deskripsi: string;

  @IsEnum(EventJenis)
  jenis: EventJenis;

  @IsOptional()
  @IsEnum(EventJenis)
  type?: EventJenis; // Alias for jenis (API compatibility)

  @Type(() => Date)
  tanggal_mulai: Date;

  @Type(() => Date)
  tanggal_selesai: Date;

  @IsString()
  lokasi: string;

  @IsString()
  daerah_id: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsOptional()
  @IsInt()
  kuota_peserta?: number;

  @IsOptional()
  @IsString()
  banner_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galeri_foto?: string[];

  @IsOptional()
  @IsString()
  persyaratan?: string;

  @IsOptional()
  @IsObject()
  formulir_custom?: Record<string, any>;

  @IsOptional()
  @IsString()
  contact_person?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;
}
```

**Step 2: Commit**

```bash
git add src/modules/events/dto/create-event.dto.ts
git commit -m "feat(events): add CreateEventDto with validation

DTO for creating events with all required fields and validators.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create DTOs - UpdateEventDto and EventFilterDto

**Files:**
- Create: `src/modules/events/dto/update-event.dto.ts
- Create: `src/modules/events/dto/event-filter.dto.ts`

**Step 1: Create UpdateEventDto**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {}
```

**Step 2: Create EventFilterDto**

```typescript
import { IsOptional, IsEnum, IsString, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { EventJenis, EventStatus } from '../entities/event.entity';

export class EventFilterDto {
  @IsOptional()
  @IsEnum(EventJenis)
  jenis?: EventJenis;

  @IsOptional()
  @IsEnum(EventJenis)
  type?: EventJenis; // Alias

  @IsOptional()
  @IsString()
  daerah_id?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'tanggal_mulai' | 'created_at' | 'jumlah_peserta';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}
```

**Step 3: Commit**

```bash
git add src/modules/events/dto/update-event.dto.ts src/modules/events/dto/event-filter.dto.ts
git commit -m "feat(events): add UpdateEventDto and EventFilterDto

Update DTO extends CreateEventDto partially.
Filter DTO supports all query parameters for event listing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Response DTOs

**Files:**
- Create: `src/modules/events/dto/event.dto.ts
- Create: `src/modules/events/dto/event-registration.dto.ts`

**Step 1: Create EventDto**

```typescript
import { EventJenis, EventStatus } from '../entities/event.entity';

export class EventDto {
  id: string;
  nama: string;
  deskripsi: string;
  jenis: EventJenis;
  type?: EventJenis; // Alias
  status: EventStatus;
  tanggal_mulai: Date;
  tanggal_selesai: Date;
  lokasi: string;
  daerah_id: string;
  latitude?: number;
  longitude?: number;
  kuota_peserta?: number;
  jumlah_peserta: number;
  banner_url?: string;
  galeri_foto?: string[];
  persyaratan?: string;
  formulir_custom?: Record<string, any>;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  daerah?: any;
  organizer?: any;
  registrationCount?: number;
  userRegistrationStatus?: string;
}
```

**Step 2: Create EventRegistrationDto**

```typescript
import { RegistrationStatus } from '../entities/event-registration.entity';

export class EventRegistrationDto {
  id: string;
  event_id: string;
  user_id: string;
  data_pendaftaran: Record<string, any>;
  status: RegistrationStatus;
  checked_in_at?: Date;
  certificate_id?: string;
  created_at: Date;
  updated_at: Date;
  event?: any;
  user?: any;
}

export class RegisterEventDto {
  data_pendaftaran?: Record<string, any>;
}
```

**Step 3: Commit**

```bash
git add src/modules/events/dto/event.dto.ts src/modules/events/dto/event-registration.dto.ts
git commit -m "feat(events): add response DTOs

EventDto and EventRegistrationDto for API responses.
RegisterEventDto for event registration input.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create EventsService

**Files:**
- Create: `src/modules/events/events.service.ts`

**Step 1: Create the events service**

```typescript
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
      await this.daerahService.findOne(createEventDto.daerah_id);
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

  async findOne(id: string, user?: User): Promise<Event> {
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

    return event;
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
      updateEventDto.jenis = updateEventDto.type as any;
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
```

**Step 2: Commit**

```bash
git add src/modules/events/events.service.ts
git commit -m "feat(events): add EventsService with CRUD operations

Service handles event creation, listing with filters, updates,
deletion, publish/cancel actions, and registration access.
Implements role-based access control and visibility rules.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create EventRegistrationsService

**Files:**
- Create: `src/modules/events/event-registrations.service.ts`

**Step 1: Create the registrations service**

```typescript
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
import { RegisterEventDto } from './dto/event-registration.dto';
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
        where: { event_id: eventId, status: RegistrationStatus.REGISTERED },
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
    registration.checked_in_at = null;
    return this.registrationRepository.save(registration);
  }

  private async updateParticipantCount(eventId: string): Promise<void> {
    const count = await this.registrationRepository.count({
      where: { event_id: eventId, status: RegistrationStatus.REGISTERED },
    });

    await this.registrationRepository.manager.update(Event, eventId, {
      jumlah_peserta: count,
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/modules/events/event-registrations.service.ts
git commit -m "feat(events): add EventRegistrationsService

Handles event registration, cancellation, check-in/undo,
and user registration listing. Updates participant counts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create EventsController

**Files:**
- Create: `src/modules/events/events.controller.ts`

**Step 1: Create the controller**

```typescript
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
import { RegisterEventDto } from './dto/event-registration.dto';
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
    const myFilter = { ...filter, created_by: user.id };
    return this.eventsService.findAll(myFilter, user);
  }

  @Get('my-registrations')
  async getMyRegistrations(@CurrentUser() user: User) {
    return this.registrationsService.getUserRegistrations(user.id);
  }

  @Get('featured')
  @Public()
  async getFeatured(@Query() filter: EventFilterDto) {
    return this.eventsService.findAll({ ...filter, isFeatured: true });
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
```

**Step 2: Commit**

```bash
git add src/modules/events/events.controller.ts
git commit -m "feat(events): add EventsController

REST API endpoints for event CRUD, registration, check-in.
Public access for listing/viewing, authenticated for registration,
kurator+ for event management.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Create EventsModule

**Files:**
- Create: `src/modules/events/events.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventRegistrationsService } from './event-registrations.service';
import { Event } from './entities/event.entity';
import { EventRegistration } from './entities/event-registration.entity';
import { DaerahModule } from '../daerah/daerah.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventRegistration]), DaerahModule],
  controllers: [EventsController],
  providers: [EventsService, EventRegistrationsService],
  exports: [EventsService, EventRegistrationsService],
})
export class EventsModule {}
```

**Step 2: Update app.module.ts**

Add import at the top:
```typescript
import { EventsModule } from './modules/events/events.module';
```

Add to imports array:
```typescript
EventsModule,
```

**Step 3: Commit**

```bash
git add src/modules/events/events.module.ts src/app.module.ts
git commit -m "feat(events): add EventsModule and register in app.module

Module exports services and registers entities with TypeORM.
Integrates with DaerahModule for region validation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Create EventsScheduler

**Files:**
- Create: `src/modules/events/events.scheduler.ts`
- Modify: `src/modules/events/events.module.ts`

**Step 1: Create the scheduler**

```typescript
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
```

**Step 2: Update events.module.ts to include ScheduleModule**

```typescript
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
```

**Step 3: Commit**

```bash
git add src/modules/events/events.scheduler.ts src/modules/events/events.module.ts
git commit -m "feat(events): add EventsScheduler for auto status updates

Cron job runs every 5 minutes to update event statuses:
- published -> ongoing when startDate reached
- ongoing -> completed when endDate reached

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Create Unit Tests

**Files:**
- Create: `src/modules/events/events.service.spec.ts`
- Create: `src/modules/events/event-registrations.service.spec.ts`

**Step 1: Create events.service.spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from './events.service';
import { EventRegistration } from './entities/event-registration.entity';
import { Event, EventStatus, EventJenis } from './entities/event.entity';
import { DaerahService } from '../daerah/daerah.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';

describe('EventsService', () => {
  let service: EventsService;
  let eventRepository: Repository<Event>;
  let registrationRepository: Repository<EventRegistration>;
  let daerahService: DaerahService;

  const mockEvent = {
    id: 'test-id',
    nama: 'Test Event',
    deskripsi: 'Test Description',
    jenis: EventJenis.TERAS_BERMAIN,
    status: EventStatus.DRAFT,
    tanggal_mulai: new Date('2026-03-01'),
    tanggal_selesai: new Date('2026-03-02'),
    lokasi: 'Test Location',
    daerah_id: 'daerah-id',
    jumlah_peserta: 0,
    created_by: 'user-id',
  };

  const mockUser: User = {
    id: 'user-id',
    email: 'test@example.com',
    role: UserRole.KURATOR_DAERAH,
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EventRegistration),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: DaerahService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    registrationRepository = module.get<Repository<EventRegistration>>(
      getRepositoryToken(EventRegistration),
    );
    daerahService = module.get<DaerahService>(DaerahService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an event', async () => {
      const createEventDto: CreateEventDto = {
        nama: 'Test Event',
        deskripsi: 'Test Description',
        jenis: EventJenis.TERAS_BERMAIN,
        tanggal_mulai: new Date('2026-03-01'),
        tanggal_selesai: new Date('2026-03-02'),
        lokasi: 'Test Location',
        daerah_id: 'daerah-id',
      };

      daerahService.findOne = jest.fn().mockResolvedValue({});
      eventRepository.create = jest.fn().mockReturnValue(mockEvent);
      eventRepository.save = jest.fn().mockResolvedValue(mockEvent);

      const result = await service.create(createEventDto, 'user-id');

      expect(result).toEqual(mockEvent);
      expect(daerahService.findOne).toHaveBeenCalledWith('daerah-id');
    });

    it('should throw BadRequestException for invalid daerah', async () => {
      const createEventDto: CreateEventDto = {
        nama: 'Test Event',
        deskripsi: 'Test Description',
        jenis: EventJenis.TERAS_BERMAIN,
        tanggal_mulai: new Date('2026-03-01'),
        tanggal_selesai: new Date('2026-03-02'),
        lokasi: 'Test Location',
        daerah_id: 'invalid-daerah-id',
      };

      daerahService.findOne = jest.fn().mockRejectedValue(new NotFoundException());

      await expect(service.create(createEventDto, 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return an event', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEvent),
      };
      eventRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findOne('test-id', mockUser);

      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException for non-existent event', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      eventRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.findOne('test-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for draft event accessed by non-creator', async () => {
      const draftEvent = { ...mockEvent, status: EventStatus.DRAFT, created_by: 'other-user-id' };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(draftEvent),
      };
      eventRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.findOne('test-id', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
```

**Step 2: Create event-registrations.service.spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventRegistrationsService } from './event-registrations.service';
import { EventRegistration, RegistrationStatus } from './entities/event-registration.entity';
import { Event, EventStatus } from './entities/event.entity';
import { EventsService } from './events.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('EventRegistrationsService', () => {
  let service: EventRegistrationsService;
  let registrationRepository: Repository<EventRegistration>;
  let eventsService: EventsService;

  const mockEvent: Event = {
    id: 'event-id',
    nama: 'Test Event',
    status: EventStatus.PUBLISHED,
    tanggal_mulai: new Date(Date.now() + 86400000), // Tomorrow
    kuota_peserta: 10,
  } as Event;

  const mockRegistration: EventRegistration = {
    id: 'reg-id',
    event_id: 'event-id',
    user_id: 'user-id',
    data_pendaftaran: {},
    status: RegistrationStatus.REGISTERED,
  } as EventRegistration;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRegistrationsService,
        {
          provide: getRepositoryToken(EventRegistration),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            manager: {
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventsService,
          useValue: {
            findOne: jest.fn(),
            isRegistrationOpen: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventRegistrationsService>(EventRegistrationsService);
    registrationRepository = module.get<Repository<EventRegistration>>(
      getRepositoryToken(EventRegistration),
    );
    eventsService = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a user for an event', async () => {
      eventsService.findOne = jest.fn().mockResolvedValue(mockEvent);
      eventsService.isRegistrationOpen = jest.fn().mockReturnValue(true);
      registrationRepository.findOne = jest.fn().mockResolvedValue(null);
      registrationRepository.count = jest.fn().mockResolvedValue(0);
      registrationRepository.create = jest.fn().mockReturnValue(mockRegistration);
      registrationRepository.save = jest.fn().mockResolvedValue(mockRegistration);

      const result = await service.register('event-id', 'user-id');

      expect(result).toEqual(mockRegistration);
    });

    it('should throw BadRequestException when registration is closed', async () => {
      eventsService.findOne = jest.fn().mockResolvedValue(mockEvent);
      eventsService.isRegistrationOpen = jest.fn().mockReturnValue(false);

      await expect(service.register('event-id', 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for duplicate registration', async () => {
      eventsService.findOne = jest.fn().mockResolvedValue(mockEvent);
      eventsService.isRegistrationOpen = jest.fn().mockReturnValue(true);
      registrationRepository.findOne = jest.fn().mockResolvedValue(mockRegistration);

      await expect(service.register('event-id', 'user-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('checkIn', () => {
    it('should check in an attendee', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(mockRegistration);
      registrationRepository.save = jest.fn().mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CHECKED_IN,
        checked_in_at: expect.any(Date),
      });

      const result = await service.checkIn('event-id', 'user-id', 'organizer-id');

      expect(result.status).toBe(RegistrationStatus.CHECKED_IN);
      expect(result.checked_in_at).toBeDefined();
    });

    it('should throw NotFoundException for non-existent registration', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.checkIn('event-id', 'user-id', 'organizer-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Step 3: Commit**

```bash
git add src/modules/events/events.service.spec.ts src/modules/events/event-registrations.service.spec.ts
git commit -m "test(events): add unit tests for services

Unit tests for EventsService and EventRegistrationsService
covering create, findOne, register, checkIn, and error cases.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Create E2E Tests

**Files:**
- Create: `test/events.e2e-spec.ts`

**Step 1: Create E2E test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus, EventJenis } from '../src/modules/events/entities/event.entity';
import { Daerah } from '../src/modules/daerah/entities/daerah.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let eventRepository: Repository<Event>;
  let daerahRepository: Repository<Daerah>;
  let userRepository: Repository<User>;

  let authToken: string;
  let adminToken: string;
  let testEventId: string;
  let testDaerahId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    eventRepository = moduleFixture.get<Repository<Event>>(getRepositoryToken(Event));
    daerahRepository = moduleFixture.get<Repository<Daerah>>(getRepositoryToken(Daerah));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Setup test data
    const daerah = await daerahRepository.save({
      nama: 'DKI Jakarta',
      kode: '31',
      provinsi: 'DKI Jakarta',
      level: 'provinsi',
    });
    testDaerahId = daerah.id;

    const user = await userRepository.save({
      supabase_user_id: 'test-user-id',
      email: 'kurator@test.com',
      full_name: 'Test Kurator',
      role: UserRole.KURATOR_DAERAH,
      status: 'active',
    });
    testUserId = user.id;

    // Mock auth token (in real test, use actual JWT)
    authToken = 'Bearer mock-kurator-token';
    adminToken = 'Bearer mock-admin-token';
  });

  afterAll(async () => {
    // Cleanup
    await eventRepository.delete({});
    await userRepository.delete({});
    await daerahRepository.delete({});
    await app.close();
  });

  describe('POST /events', () => {
    it('should create an event', () => {
      const createEventDto = {
        nama: 'Teras Bermain Congklak',
        deskripsi: 'Belajar congklak bersama',
        jenis: EventJenis.TERAS_BERMAIN,
        tanggal_mulai: '2026-03-01T10:00:00Z',
        tanggal_selesai: '2026-03-01T12:00:00Z',
        lokasi: 'Taman Budaya Jakarta',
        daerah_id: testDaerahId,
        contact_person: 'Budi Santoso',
        contact_phone: '08123456789',
      };

      return request(app.getHttpServer())
        .post('/events')
        .set('Authorization', authToken)
        .send(createEventDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.nama).toBe(createEventDto.nama);
          expect(res.body.status).toBe(EventStatus.DRAFT);
          testEventId = res.body.id;
        });
    });

    it('should fail without authentication', () => {
      const createEventDto = {
        nama: 'Test Event',
        deskripsi: 'Test',
        jenis: EventJenis.WORKSHOP,
        tanggal_mulai: '2026-03-01T10:00:00Z',
        tanggal_selesai: '2026-03-01T12:00:00Z',
        lokasi: 'Test Location',
        daerah_id: testDaerahId,
      };

      return request(app.getHttpServer())
        .post('/events')
        .send(createEventDto)
        .expect(401);
    });
  });

  describe('GET /events', () => {
    it('should list published events publicly', () => {
      return request(app.getHttpServer())
        .get('/events')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body).toHaveProperty('pagination');
        });
    });

    it('should filter by jenis', () => {
      return request(app.getHttpServer())
        .get('/events?jenis=teras_bermain')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('GET /events/:id', () => {
    it('should get an event by id', () => {
      return request(app.getHttpServer())
        .get(`/events/${testEventId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testEventId);
        });
    });

    it('should return 404 for non-existent event', () => {
      return request(app.getHttpServer())
        .get('/events/non-existent-id')
        .expect(404);
    });
  });

  describe('PATCH /events/:id/publish', () => {
    it('should publish an event', () => {
      return request(app.getHttpServer())
        .patch(`/events/${testEventId}/publish`)
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(EventStatus.PUBLISHED);
          expect(res.body.published_at).toBeDefined();
        });
    });
  });

  describe('POST /events/:id/register', () => {
    it('should register for an event', () => {
      return request(app.getHttpServer())
        .post(`/events/${testEventId}/register`)
        .set('Authorization', authToken)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.status).toBe('registered');
        });
    });

    it('should prevent duplicate registration', () => {
      return request(app.getHttpServer())
        .post(`/events/${testEventId}/register`)
        .set('Authorization', authToken)
        .expect(409);
    });
  });

  describe('PATCH /events/:id/registrations/:userId/check-in', () => {
    it('should check in an attendee', () => {
      return request(app.getHttpServer())
        .patch(`/events/${testEventId}/registrations/${testUserId}/check-in`)
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('checked_in');
          expect(res.body.checked_in_at).toBeDefined();
        });
    });
  });
});
```

**Step 2: Commit**

```bash
git add test/events.e2e-spec.ts
git commit -m "test(events): add E2E tests for events API

End-to-end tests covering event creation, listing,
registration, check-in, and authentication.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Update package.json Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add test script**

Run: `npm pkg set scripts:test:e2e="jest --config ./test/jest-e2e.json"`

Expected: No error

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add e2e test script to package.json

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Final Verification

**Step 1: Build the project**

Run: `npm run build`

Expected: No errors

**Step 2: Run unit tests**

Run: `npm test`

Expected: Tests pass

**Step 3: Run E2E tests**

Run: `npm run test:e2e`

Expected: E2E tests pass

**Step 4: Commit any fixes**

If any issues found, fix them and commit.

```bash
git add -A
git commit -m "fix(events): resolve test issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete Checklist

- [x] Event entity created
- [x] EventRegistration entity created
- [x] All DTOs created (Create, Update, Filter, Response)
- [x] EventsService with full CRUD
- [x] EventRegistrationsService with registration logic
- [x] EventsController with all endpoints
- [x] EventsModule configured
- [x] EventsScheduler for auto status updates
- [x] Unit tests written
- [x] E2E tests written
- [x] Module registered in app.module.ts

## Next Steps (Not in this plan)

1. Implement notification service integration
2. Add certificate generation endpoints
3. Add file upload for banner images
4. Add QR code generation for check-ins
5. Add comprehensive API documentation
