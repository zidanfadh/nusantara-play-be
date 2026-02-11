import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from '../events.service';
import { EventRegistration, RegistrationStatus } from '../entities/event-registration.entity';
import { Event, EventStatus, EventJenis } from '../entities/event.entity';
import { DaerahService } from '../../daerah/daerah.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../../users/entities/user.entity';

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
            findById: jest.fn(),
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
      const createEventDto = {
        nama: 'Test Event',
        deskripsi: 'Test Description',
        jenis: EventJenis.TERAS_BERMAIN,
        tanggal_mulai: new Date('2026-03-01'),
        tanggal_selesai: new Date('2026-03-02'),
        lokasi: 'Test Location',
        daerah_id: 'daerah-id',
      };

      daerahService.findById = jest.fn().mockResolvedValue({});
      eventRepository.create = jest.fn().mockReturnValue(mockEvent);
      eventRepository.save = jest.fn().mockResolvedValue(mockEvent);

      const result = await service.create(createEventDto, 'user-id');

      expect(result).toEqual(mockEvent);
      expect(daerahService.findById).toHaveBeenCalledWith('daerah-id');
    });

    it('should throw BadRequestException for invalid daerah', async () => {
      const createEventDto = {
        nama: 'Test Event',
        deskripsi: 'Test Description',
        jenis: EventJenis.TERAS_BERMAIN,
        tanggal_mulai: new Date('2026-03-01'),
        tanggal_selesai: new Date('2026-03-02'),
        lokasi: 'Test Location',
        daerah_id: 'invalid-daerah-id',
      };

      daerahService.findById = jest.fn().mockRejectedValue(new NotFoundException());

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
      const otherUser = { ...mockUser, id: 'different-user' };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(draftEvent),
      };
      eventRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.findOne('test-id', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('publish', () => {
    it('should publish an event', async () => {
      const eventToPublish = { ...mockEvent, status: EventStatus.DRAFT };
      eventRepository.findOne = jest.fn().mockResolvedValue(eventToPublish);
      eventRepository.save = jest.fn().mockResolvedValue({
        ...eventToPublish,
        status: EventStatus.PUBLISHED,
        published_at: expect.any(Date),
      });

      const result = await service.publish('test-id', 'user-id', UserRole.KURATOR_DAERAH);

      expect(result.status).toBe(EventStatus.PUBLISHED);
      expect(result.published_at).toBeDefined();
    });

    it('should throw BadRequestException when event is not draft', async () => {
      const publishedEvent = { ...mockEvent, status: EventStatus.PUBLISHED };
      eventRepository.findOne = jest.fn().mockResolvedValue(publishedEvent);

      await expect(
        service.publish('test-id', 'user-id', UserRole.KURATOR_DAERAH),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel an event', async () => {
      const eventToCancel = { ...mockEvent, status: EventStatus.PUBLISHED };
      eventRepository.findOne = jest.fn().mockResolvedValue(eventToCancel);
      eventRepository.save = jest.fn().mockResolvedValue({
        ...eventToCancel,
        status: EventStatus.CANCELLED,
      });

      const result = await service.cancel('test-id', 'user-id', UserRole.KURATOR_DAERAH);

      expect(result.status).toBe(EventStatus.CANCELLED);
    });

    it('should throw BadRequestException when event already completed', async () => {
      const completedEvent = { ...mockEvent, status: EventStatus.COMPLETED };
      eventRepository.findOne = jest.fn().mockResolvedValue(completedEvent);

      await expect(
        service.cancel('test-id', 'user-id', UserRole.KURATOR_DAERAH),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isRegistrationOpen', () => {
    it('should return true for published event in future', () => {
      const futureEvent = {
        ...mockEvent,
        status: EventStatus.PUBLISHED,
        tanggal_mulai: new Date(Date.now() + 86400000),
      };
      expect(service.isRegistrationOpen(futureEvent as Event)).toBe(true);
    });

    it('should return false for draft event', () => {
      const draftEvent = { ...mockEvent, status: EventStatus.DRAFT };
      expect(service.isRegistrationOpen(draftEvent as Event)).toBe(false);
    });

    it('should return false for past event', () => {
      const pastEvent = {
        ...mockEvent,
        status: EventStatus.PUBLISHED,
        tanggal_mulai: new Date(Date.now() - 86400000),
      };
      expect(service.isRegistrationOpen(pastEvent as Event)).toBe(false);
    });
  });
});
