import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventRegistrationsService } from '../event-registrations.service';
import { EventRegistration, RegistrationStatus } from '../entities/event-registration.entity';
import { Event, EventStatus } from '../entities/event.entity';
import { EventsService } from '../events.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('EventRegistrationsService', () => {
  let service: EventRegistrationsService;
  let registrationRepository: Repository<EventRegistration>;
  let eventsService: EventsService;

  const mockEvent: Event = {
    id: 'event-id',
    nama: 'Test Event',
    status: EventStatus.PUBLISHED,
    tanggal_mulai: new Date(Date.now() + 86400000),
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
      const closedEvent = { ...mockEvent, status: EventStatus.COMPLETED };
      eventsService.findOne = jest.fn().mockResolvedValue(closedEvent);
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

    it('should throw BadRequestException when event is fully booked', async () => {
      const fullEvent = { ...mockEvent, kuota_peserta: 5 };
      eventsService.findOne = jest.fn().mockResolvedValue(fullEvent);
      eventsService.isRegistrationOpen = jest.fn().mockReturnValue(true);
      registrationRepository.findOne = jest.fn().mockResolvedValue(null);
      registrationRepository.count = jest.fn().mockResolvedValue(5);

      await expect(service.register('event-id', 'user-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should re-register cancelled registration', async () => {
      const cancelledReg = { ...mockRegistration, status: RegistrationStatus.CANCELLED };
      eventsService.findOne = jest.fn().mockResolvedValue(mockEvent);
      eventsService.isRegistrationOpen = jest.fn().mockReturnValue(true);
      registrationRepository.findOne = jest.fn().mockResolvedValue(cancelledReg);
      registrationRepository.save = jest.fn().mockResolvedValue({
        ...cancelledReg,
        status: RegistrationStatus.REGISTERED,
      });

      const result = await service.register('event-id', 'user-id');

      expect(result.status).toBe(RegistrationStatus.REGISTERED);
    });
  });

  describe('cancelRegistration', () => {
    it('should cancel a registration', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(mockRegistration);
      registrationRepository.save = jest.fn().mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
      });

      await service.cancelRegistration('event-id', 'user-id');

      expect(registrationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RegistrationStatus.CANCELLED,
        }),
      );
    });

    it('should throw NotFoundException for non-existent registration', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.cancelRegistration('event-id', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already cancelled', async () => {
      const cancelledReg = { ...mockRegistration, status: RegistrationStatus.CANCELLED };
      registrationRepository.findOne = jest.fn().mockResolvedValue(cancelledReg);

      await expect(
        service.cancelRegistration('event-id', 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when already checked in', async () => {
      const checkedInReg = { ...mockRegistration, status: RegistrationStatus.CHECKED_IN };
      registrationRepository.findOne = jest.fn().mockResolvedValue(checkedInReg);

      await expect(
        service.cancelRegistration('event-id', 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkIn', () => {
    it('should check in an attendee', async () => {
      const registeredReg: EventRegistration = {
        id: 'reg-id',
        event_id: 'event-id',
        user_id: 'user-id',
        data_pendaftaran: {},
        status: RegistrationStatus.REGISTERED,
      };
      registrationRepository.findOne = jest.fn().mockResolvedValue(registeredReg);
      registrationRepository.save = jest.fn().mockResolvedValue({
        id: 'reg-id',
        event_id: 'event-id',
        user_id: 'user-id',
        data_pendaftaran: {},
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

    it('should throw BadRequestException when already checked in', async () => {
      const checkedInReg: EventRegistration = {
        id: 'reg-id',
        event_id: 'event-id',
        user_id: 'user-id',
        data_pendaftaran: {},
        status: RegistrationStatus.CHECKED_IN,
      };
      registrationRepository.findOne = jest.fn().mockResolvedValue(checkedInReg);

      await expect(
        service.checkIn('event-id', 'user-id', 'organizer-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when registration is cancelled', async () => {
      const cancelledReg: EventRegistration = {
        id: 'reg-id',
        event_id: 'event-id',
        user_id: 'user-id',
        data_pendaftaran: {},
        status: RegistrationStatus.CANCELLED,
      };
      registrationRepository.findOne = jest.fn().mockResolvedValue(cancelledReg);

      await expect(
        service.checkIn('event-id', 'user-id', 'organizer-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('undoCheckIn', () => {
    it('should undo check in', async () => {
      const checkedInReg = { ...mockRegistration, status: RegistrationStatus.CHECKED_IN };
      registrationRepository.findOne = jest.fn().mockResolvedValue(checkedInReg);
      registrationRepository.save = jest.fn().mockResolvedValue({
        ...checkedInReg,
        status: RegistrationStatus.REGISTERED,
        checked_in_at: null,
      });

      const result = await service.undoCheckIn('event-id', 'user-id', 'organizer-id');

      expect(result.status).toBe(RegistrationStatus.REGISTERED);
      expect(result.checked_in_at).toBeNull();
    });

    it('should throw NotFoundException for non-existent registration', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.undoCheckIn('event-id', 'user-id', 'organizer-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not checked in', async () => {
      registrationRepository.findOne = jest.fn().mockResolvedValue(mockRegistration);

      await expect(
        service.undoCheckIn('event-id', 'user-id', 'organizer-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
