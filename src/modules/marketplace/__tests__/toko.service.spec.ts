import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TokoService } from '../toko.service';
import { Toko } from '../entities/toko.entity';

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('TokoService', () => {
  let service: TokoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokoService,
        { provide: getRepositoryToken(Toko), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TokoService>(TokoService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new toko for user', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // no existing toko for user
      mockRepo.findOne.mockResolvedValueOnce(null); // slug not taken
      mockRepo.create.mockReturnValue({ id: 'uuid', user_id: 'user-1', nama: 'Toko A', slug: 'toko-a' });
      mockRepo.save.mockResolvedValue({ id: 'uuid', user_id: 'user-1', nama: 'Toko A', slug: 'toko-a' });

      const result = await service.create('user-1', { nama: 'Toko A', slug: 'toko-a' });

      expect(result.nama).toBe('Toko A');
    });

    it('should throw ConflictException when user already has a toko', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 'existing', user_id: 'user-1' });

      await expect(
        service.create('user-1', { nama: 'Toko B', slug: 'toko-b' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when slug already taken', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // no toko for user
      mockRepo.findOne.mockResolvedValueOnce({ id: 'other', slug: 'toko-a' }); // slug taken

      await expect(
        service.create('user-1', { nama: 'Toko A', slug: 'toko-a' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findMy', () => {
    it('should return user toko', async () => {
      const toko = { id: 'uuid', user_id: 'user-1', nama: 'Toko A' };
      mockRepo.findOne.mockResolvedValue(toko);

      const result = await service.findMy('user-1');

      expect(result).toEqual(toko);
    });

    it('should throw NotFoundException when user has no toko', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findMy('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when user does not own toko', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'uuid', user_id: 'other-user' });

      await expect(
        service.update('uuid', 'user-1', { nama: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
