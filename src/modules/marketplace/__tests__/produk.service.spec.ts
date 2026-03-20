import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProdukService } from '../produk.service';
import { Produk } from '../entities/produk.entity';
import { Toko } from '../entities/toko.entity';
import { PROT } from '../../prot/entities/prot.entity';

const mockProdukRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};
const mockTokoRepo = { findOne: jest.fn() };
const mockProtRepo = { findOne: jest.fn() };

describe('ProdukService', () => {
  let service: ProdukService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdukService,
        { provide: getRepositoryToken(Produk), useValue: mockProdukRepo },
        { provide: getRepositoryToken(Toko), useValue: mockTokoRepo },
        { provide: getRepositoryToken(PROT), useValue: mockProtRepo },
      ],
    }).compile();

    service = module.get<ProdukService>(ProdukService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw NotFoundException when user has no toko', async () => {
      mockTokoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', { nama: 'Produk A', slug: 'produk-a', harga: 50000, stok: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create product for toko owner', async () => {
      mockTokoRepo.findOne.mockResolvedValue({ id: 'toko-1', user_id: 'user-1' });
      mockProdukRepo.findOne.mockResolvedValue(null);
      const product = { id: 'prod-1', toko_id: 'toko-1', nama: 'Produk A', prots: [] };
      mockProdukRepo.create.mockReturnValue(product);
      mockProdukRepo.save.mockResolvedValue(product);

      const result = await service.create('user-1', {
        nama: 'Produk A',
        slug: 'produk-a',
        harga: 50000,
        stok: 10,
      });

      expect(result.nama).toBe('Produk A');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when product not found', async () => {
      mockProdukRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when user does not own the product toko', async () => {
      mockProdukRepo.findOne.mockResolvedValue({
        id: 'prod-1',
        toko_id: 'toko-1',
        toko: { user_id: 'other-user' },
      });

      await expect(
        service.update('prod-1', 'user-1', { nama: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
