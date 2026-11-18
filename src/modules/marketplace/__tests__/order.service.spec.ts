import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

// Conditional UPDATE builder (B4). Every call shares one builder; execute()
// results are queued per test with mockResolvedValueOnce.
const mockUpdateBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => mockUpdateBuilder),
  },
};

/** The `id` parameter of every `.where(..., { id })` call, in call order. */
const whereIds = (): string[] =>
  mockUpdateBuilder.where.mock.calls.map(
    (c: unknown[]) => (c[1] as { id: string }).id,
  );

const shippingAddress = {
  nama_penerima: 'Test',
  phone: '08123',
  alamat_lengkap: 'Jl. Test',
  kota: 'Jakarta',
  provinsi: 'DKI Jakarta',
};

const privateBuyer = {
  id: 'buyer-1',
  full_name: 'Buyer',
  email: 'buyer@example.test',
  supabase_user_id: '00000000-0000-0000-0000-000000000003',
  last_login_at: new Date(),
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
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 'toko-1',
        user_id: 'buyer-1',
      });

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

    describe('stock (B4)', () => {
      beforeEach(() => {
        // toko lookup inside the transaction
        mockQueryRunner.manager.findOne.mockResolvedValueOnce({
          id: 'toko-1',
          user_id: 'seller-1',
        });
        mockQueryRunner.manager.create.mockImplementation(
          (_entity: unknown, data: object) => ({ ...data }),
        );
        mockQueryRunner.manager.save.mockImplementation(
          (_entity: unknown, data: object) =>
            Promise.resolve({ id: 'order-1', ...data }),
        );
        mockOrderRepo.findOne.mockResolvedValue({
          id: 'order-1',
          buyer: privateBuyer,
          items: [],
        });
      });

      it('merges duplicate produk_id lines, sorts by id and decrements atomically', async () => {
        mockUpdateBuilder.execute
          .mockResolvedValueOnce({
            affected: 1,
            raw: [{ id: 'prod-a', nama: 'A', harga: '1000.00' }],
          })
          .mockResolvedValueOnce({
            affected: 1,
            raw: [{ id: 'prod-b', nama: 'B', harga: '2500.50' }],
          });

        await service.create('buyer-1', {
          toko_id: 'toko-1',
          items: [
            { produk_id: 'prod-b', qty: 1 },
            { produk_id: 'prod-a', qty: 2 },
            { produk_id: 'prod-b', qty: 3 },
          ],
          shipping_address: shippingAddress,
        });

        // Two UPDATEs (merged), in produk id order.
        expect(mockUpdateBuilder.execute).toHaveBeenCalledTimes(2);
        const ids = whereIds();
        expect(ids).toEqual(['prod-a', 'prod-b']);
        const qtys = mockUpdateBuilder.setParameter.mock.calls.map(
          (c: unknown[]) => c[1],
        );
        expect(qtys).toEqual([2, 4]);
        expect(mockUpdateBuilder.update).toHaveBeenCalledWith(Produk);
        expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith(
          'toko_id = :tokoId',
          { tokoId: 'toko-1' },
        );
        expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith(
          'is_active = true',
        );
        expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith('stok >= :qty');

        // Totals from the prices read in the same UPDATE ... RETURNING.
        const createCalls = mockQueryRunner.manager.create.mock
          .calls as unknown[][];
        const orderData = createCalls.find((c) => c[0] === Order)?.[1] as {
          total_harga: number;
        };
        expect(orderData.total_harga).toBe(2 * 1000 + 4 * 2500.5);
        const itemData = mockQueryRunner.manager.create.mock.calls
          .filter((c: unknown[]) => c[0] === OrderItem)
          .map((c: unknown[]) => c[1] as Partial<OrderItem>);
        expect(itemData).toEqual([
          expect.objectContaining({
            produk_id: 'prod-a',
            nama_produk: 'A',
            qty: 2,
            harga_satuan: 1000,
            subtotal: 2000,
          }),
          expect.objectContaining({
            produk_id: 'prod-b',
            nama_produk: 'B',
            qty: 4,
            harga_satuan: 2500.5,
            subtotal: 10002,
          }),
        ]);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('throws "stok tidak mencukupi" and rolls back when no row was updated', async () => {
        mockUpdateBuilder.execute.mockResolvedValueOnce({
          affected: 0,
          raw: [],
        });
        // existence check inside the transaction: product exists
        mockQueryRunner.manager.findOne.mockResolvedValueOnce({
          id: 'prod-a',
          nama: 'Gasing Kayu',
        });

        await expect(
          service.create('buyer-1', {
            toko_id: 'toko-1',
            items: [{ produk_id: 'prod-a', qty: 5 }],
            shipping_address: shippingAddress,
          }),
        ).rejects.toThrow(
          new BadRequestException("Stok produk 'Gasing Kayu' tidak mencukupi"),
        );
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      });

      it('keeps the NotFound error when the product is not in this toko', async () => {
        mockUpdateBuilder.execute.mockResolvedValueOnce({
          affected: 0,
          raw: [],
        });
        mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

        await expect(
          service.create('buyer-1', {
            toko_id: 'toko-1',
            items: [{ produk_id: 'prod-x', qty: 1 }],
            shipping_address: shippingAddress,
          }),
        ).rejects.toThrow(NotFoundException);
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      });

      it('returns the order without the buyer private fields (P1)', async () => {
        mockUpdateBuilder.execute.mockResolvedValueOnce({
          affected: 1,
          raw: [{ id: 'prod-a', nama: 'A', harga: '1000.00' }],
        });

        const order = await service.create('buyer-1', {
          toko_id: 'toko-1',
          items: [{ produk_id: 'prod-a', qty: 1 }],
          shipping_address: shippingAddress,
        });

        expect(order.buyer).not.toHaveProperty('supabase_user_id');
        expect(order.buyer).not.toHaveProperty('last_login_at');
        expect(order.buyer).toMatchObject({ email: 'buyer@example.test' });
      });
    });
  });

  describe('buyer private fields (P1)', () => {
    it('findSellerOrders strips supabase_user_id and last_login_at from buyers', async () => {
      mockTokoRepo.findOne.mockResolvedValue({ id: 'toko-1' });
      mockOrderRepo.find.mockResolvedValue([
        { id: 'order-1', buyer: privateBuyer },
      ]);

      const [order] = await service.findSellerOrders('seller-1');

      expect(order.buyer).not.toHaveProperty('supabase_user_id');
      expect(order.buyer).not.toHaveProperty('last_login_at');
      expect(order.buyer.full_name).toBe('Buyer');
    });

    it('findOne strips supabase_user_id and last_login_at from the buyer', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        buyer_id: 'buyer-1',
        buyer: privateBuyer,
        toko: { user_id: 'seller-1' },
      });

      const order = await service.findOne('order-1', 'seller-1');

      expect(order.buyer).not.toHaveProperty('supabase_user_id');
      expect(order.buyer).not.toHaveProperty('last_login_at');
    });
  });

  describe('konfirmasi', () => {
    it('should throw ForbiddenException when non-seller tries to confirm', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when order is not in MENUNGGU status', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.DIKONFIRMASI,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'seller-1')).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.batalkan('order-1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('cancels with a conditional UPDATE and restores stock atomically, in produk id order (B4)', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({
          id: 'order-1',
          buyer_id: 'buyer-1',
          status: OrderStatus.MENUNGGU,
          toko: { user_id: 'seller-1' },
        })
        .mockResolvedValueOnce({
          id: 'order-1',
          status: OrderStatus.DIBATALKAN,
        });
      mockUpdateBuilder.execute.mockResolvedValue({ affected: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([
        { produk_id: 'prod-b', qty: 1 },
        { produk_id: 'prod-a', qty: 2 },
      ]);

      const result = await service.batalkan('order-1', 'buyer-1');

      expect(result.status).toBe(OrderStatus.DIBATALKAN);
      // 1st UPDATE: order status, only from the statuses the buyer may cancel
      expect(mockUpdateBuilder.update).toHaveBeenNthCalledWith(1, Order);
      expect(mockUpdateBuilder.set).toHaveBeenNthCalledWith(1, {
        status: OrderStatus.DIBATALKAN,
      });
      expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith(
        'status IN (:...allowed)',
        { allowed: [OrderStatus.MENUNGGU] },
      );
      // then one increment per item, sorted by produk id
      expect(mockUpdateBuilder.update).toHaveBeenNthCalledWith(2, Produk);
      expect(mockUpdateBuilder.update).toHaveBeenNthCalledWith(3, Produk);
      const restoreIds = whereIds().slice(1);
      expect(restoreIds).toEqual(['prod-a', 'prod-b']);
      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(OrderItem, {
        where: { order_id: 'order-1' },
        order: { produk_id: 'ASC' },
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('lets the seller cancel from MENUNGGU or DIKONFIRMASI', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({
          id: 'order-1',
          buyer_id: 'buyer-1',
          status: OrderStatus.DIKONFIRMASI,
          toko: { user_id: 'seller-1' },
        })
        .mockResolvedValueOnce({ id: 'order-1' });
      mockUpdateBuilder.execute.mockResolvedValue({ affected: 1 });
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await service.batalkan('order-1', 'seller-1');

      expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith(
        'status IN (:...allowed)',
        { allowed: [OrderStatus.MENUNGGU, OrderStatus.DIKONFIRMASI] },
      );
    });

    it('does not restore stock when the status UPDATE changed no row (already cancelled)', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce({
        id: 'order-1',
        buyer_id: 'buyer-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
      });
      mockUpdateBuilder.execute.mockResolvedValueOnce({ affected: 0 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 'order-1',
        status: OrderStatus.DIBATALKAN,
      });

      await expect(service.batalkan('order-1', 'buyer-1')).rejects.toThrow(
        new BadRequestException(
          `Order tidak dapat dibatalkan pada status ${OrderStatus.DIBATALKAN}`,
        ),
      );
      expect(mockUpdateBuilder.execute).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.manager.find).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
