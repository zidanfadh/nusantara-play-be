/**
 * B4 (Phase 06): marketplace stock is race-safe. Runs OrderService against the
 * real local test database with truly concurrent transactions.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { OrderService } from '../../src/modules/marketplace/order.service';
import {
  Order,
  OrderStatus,
} from '../../src/modules/marketplace/entities/order.entity';
import { OrderItem } from '../../src/modules/marketplace/entities/order-item.entity';
import { Produk } from '../../src/modules/marketplace/entities/produk.entity';
import { Toko } from '../../src/modules/marketplace/entities/toko.entity';
import { CreateOrderDto } from '../../src/modules/marketplace/dto/create-order.dto';
import { User } from '../../src/modules/users/entities/user.entity';
import { Fixtures } from './fixtures';

const shipping_address = {
  nama_penerima: 'INT Penerima',
  phone: '+62 800 0000 0001',
  alamat_lengkap: 'Jl. Integrasi 1',
  kota: 'Bandung',
  provinsi: 'Jawa Barat',
};

describe('OrderService stock (integration, real database, B4)', () => {
  let moduleRef: TestingModule;
  let service: OrderService;
  let dataSource: DataSource;
  let fx: Fixtures;
  let seller: User;
  let toko: Toko;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...buildDataSourceOptions((key) => process.env[key]),
          // Enough connections for every parallel transaction at once.
          extra: { max: 20 },
        }),
        TypeOrmModule.forFeature([Order, OrderItem, Produk, Toko]),
      ],
      providers: [OrderService],
    }).compile();
    service = moduleRef.get(OrderService);
    dataSource = moduleRef.get(DataSource);
    fx = new Fixtures(dataSource);
    seller = await fx.user();
    toko = await fx.toko(seller);
  });

  afterAll(async () => {
    await fx.cleanup();
    await moduleRef.close();
  });

  const order = (produkId: string, qty = 1): CreateOrderDto => ({
    toko_id: toko.id,
    items: [{ produk_id: produkId, qty }],
    shipping_address,
  });

  it('10 parallel orders for a product with stock 3: exactly 3 succeed, stock ends at 0', async () => {
    const produk = await fx.produk(toko, 3);
    const buyers = await Promise.all(
      Array.from({ length: 10 }, () => fx.user()),
    );

    const results = await Promise.allSettled(
      buyers.map((buyer) => service.create(buyer.id, order(produk.id))),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(BadRequestException);
      expect((r.reason as Error).message).toContain('tidak mencukupi');
    }
    expect(await fx.stok(produk.id)).toBe(0);
    const orderCount = await dataSource
      .getRepository(OrderItem)
      .countBy({ produk_id: produk.id });
    expect(orderCount).toBe(3);
  });

  it('2 parallel cancels of the same order restore the stock once', async () => {
    const produk = await fx.produk(toko, 3);
    const buyer = await fx.user();
    const created = await service.create(buyer.id, order(produk.id, 2));
    expect(await fx.stok(produk.id)).toBe(1);

    const results = await Promise.allSettled([
      service.batalkan(created.id, buyer.id),
      service.batalkan(created.id, buyer.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [rejected] = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rejected.reason).toBeInstanceOf(BadRequestException);
    expect(await fx.stok(produk.id)).toBe(3);
    const saved = await dataSource
      .getRepository(Order)
      .findOneByOrFail({ id: created.id });
    expect(saved.status).toBe(OrderStatus.DIBATALKAN);
  });

  it('merges duplicate lines into one order item and one decrement', async () => {
    const produk = await fx.produk(toko, 5, 2500);
    const buyer = await fx.user();

    const created = await service.create(buyer.id, {
      toko_id: toko.id,
      items: [
        { produk_id: produk.id, qty: 1 },
        { produk_id: produk.id, qty: 2 },
      ],
      shipping_address,
    });

    expect(created.items).toHaveLength(1);
    expect(created.items[0].qty).toBe(3);
    expect(Number(created.total_harga)).toBe(7500);
    expect(await fx.stok(produk.id)).toBe(2);
    expect(created.buyer).not.toHaveProperty('supabase_user_id');
    expect(created.buyer).not.toHaveProperty('last_login_at');
  });

  it('a rejected order leaves the stock of every product unchanged (rollback)', async () => {
    const enough = await fx.produk(toko, 5);
    const short = await fx.produk(toko, 1);
    const buyer = await fx.user();

    await expect(
      service.create(buyer.id, {
        toko_id: toko.id,
        items: [
          { produk_id: enough.id, qty: 2 },
          { produk_id: short.id, qty: 2 },
        ],
        shipping_address,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(await fx.stok(enough.id)).toBe(5);
    expect(await fx.stok(short.id)).toBe(1);
  });
});
