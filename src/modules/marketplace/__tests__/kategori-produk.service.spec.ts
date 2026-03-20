import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { KategoriProdukService } from '../kategori-produk.service';
import { KategoriProduk } from '../entities/kategori-produk.entity';

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('KategoriProdukService', () => {
  let service: KategoriProdukService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KategoriProdukService,
        { provide: getRepositoryToken(KategoriProduk), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<KategoriProdukService>(KategoriProdukService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ id: 'uuid', nama: 'Peralatan', slug: 'peralatan' });
      mockRepo.save.mockResolvedValue({ id: 'uuid', nama: 'Peralatan', slug: 'peralatan' });

      const result = await service.create({ nama: 'Peralatan', slug: 'peralatan' });

      expect(result.nama).toBe('Peralatan');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when slug already exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'existing', slug: 'peralatan' });

      await expect(
        service.create({ nama: 'Peralatan', slug: 'peralatan' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [{ id: '1', nama: 'Peralatan', slug: 'peralatan' }];
      mockRepo.find.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should return category by id', async () => {
      const category = { id: 'uuid', nama: 'Peralatan', slug: 'peralatan' };
      mockRepo.findOne.mockResolvedValue(category);

      const result = await service.findOne('uuid');

      expect(result).toEqual(category);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove category', async () => {
      const category = { id: 'uuid', nama: 'Peralatan', slug: 'peralatan' };
      mockRepo.findOne.mockResolvedValue(category);
      mockRepo.remove.mockResolvedValue(category);

      await service.remove('uuid');

      expect(mockRepo.remove).toHaveBeenCalledWith(category);
    });
  });
});
