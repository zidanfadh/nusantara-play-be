import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from '../order.service';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Produk } from '../entities/produk.entity';
import { Toko } from '../entities/toko.entity';

const mockOrderRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockOrderItemRepo = { create: jest.fn() };
const mockProdukRepo = { findOne: jest.fn() };
const mockTokoRepo = { findOne: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: mockOrderItemRepo },
        { provide: getRepositoryToken(Produk), useValue: mockProdukRepo },
        { provide: getRepositoryToken(Toko), useValue: mockTokoRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  describe('create', () => {
    it('should throw NotFoundException when toko not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.create('buyer-1', {
          toko_id: 'nonexistent',
          items: [{ produk_id: 'prod-1', qty: 1 }],
          shipping_address: {
            nama_penerima: 'Test',
            phone: '08123',
            alamat_lengkap: 'Jl. Test',
            kota: 'Jakarta',
            provinsi: 'DKI Jakarta',
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when buyer is the toko owner', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ id: 'toko-1', user_id: 'buyer-1' });

      await expect(
        service.create('buyer-1', {
          toko_id: 'toko-1',
          items: [{ produk_id: 'prod-1', qty: 1 }],
          shipping_address: {
            nama_penerima: 'Test',
            phone: '08123',
            alamat_lengkap: 'Jl. Test',
            kota: 'Jakarta',
            provinsi: 'DKI Jakarta',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('konfirmasi', () => {
    it('should throw ForbiddenException when non-seller tries to confirm', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order is not in MENUNGGU status', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.DIKONFIRMASI,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'seller-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('batalkan', () => {
    it('should throw ForbiddenException when non-participant tries to cancel', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        buyer_id: 'buyer-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
        items: [],
      });

      await expect(service.batalkan('order-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });
});
