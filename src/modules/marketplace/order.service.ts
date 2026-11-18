import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Produk } from './entities/produk.entity';
import { Toko } from './entities/toko.entity';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { KirimOrderDto } from './dto/kirim-order.dto';
import { stripPrivateUserFields } from '../../common/serializers/user-shape';

/** Row returned by the stock-decrement UPDATE ... RETURNING. */
interface DecrementedProduk {
  id: string;
  nama: string;
  harga: string | number;
}

/**
 * Merges duplicate produk_id lines (summing qty) and sorts them by produk id,
 * so concurrent orders always lock produk rows in the same order (no
 * deadlocks) and each product gets exactly one conditional UPDATE (B4).
 */
export function mergeOrderLines(
  items: OrderItemDto[],
): { produk_id: string; qty: number }[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.produk_id, (merged.get(item.produk_id) ?? 0) + item.qty);
  }
  return [...merged.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([produk_id, qty]) => ({ produk_id, qty }));
}

/** The buyer is another user for the seller: no private fields (P1). */
function withoutPrivateBuyerFields<T extends { buyer?: Order['buyer'] }>(
  order: T,
): T {
  if (!order.buyer) {
    return order;
  }
  return {
    ...order,
    buyer: stripPrivateUserFields(order.buyer),
  } as T;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Produk)
    private readonly produkRepo: Repository<Produk>,
    @InjectRepository(Toko)
    private readonly tokoRepo: Repository<Toko>,
    private readonly dataSource: DataSource,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const toko = await qr.manager.findOne(Toko, {
        where: { id: dto.toko_id },
      });
      if (!toko) {
        throw new NotFoundException('Toko tidak ditemukan');
      }
      if (toko.user_id === buyerId) {
        throw new BadRequestException(
          'Anda tidak dapat membeli dari toko sendiri',
        );
      }

      let totalHarga = 0;
      const itemEntities: Partial<OrderItem>[] = [];

      for (const line of mergeOrderLines(dto.items)) {
        // Atomic, race-safe stock decrement (B4): the WHERE re-checks the
        // stock in the same statement, and RETURNING reads name and price in
        // the same transaction.
        const result = await qr.manager
          .createQueryBuilder()
          .update(Produk)
          .set({ stok: () => 'stok - :qty' })
          .where('id = :id', { id: line.produk_id })
          .andWhere('toko_id = :tokoId', { tokoId: dto.toko_id })
          .andWhere('is_active = true')
          .andWhere('stok >= :qty')
          .setParameter('qty', line.qty)
          .returning(['id', 'nama', 'harga'])
          .execute();

        const rows = (result.raw ?? []) as DecrementedProduk[];
        if (!result.affected || rows.length === 0) {
          const produk = await qr.manager.findOne(Produk, {
            where: {
              id: line.produk_id,
              toko_id: dto.toko_id,
              is_active: true,
            },
          });
          if (!produk) {
            throw new NotFoundException(
              `Produk '${line.produk_id}' tidak ditemukan di toko ini`,
            );
          }
          throw new BadRequestException(
            `Stok produk '${produk.nama}' tidak mencukupi`,
          );
        }

        const produk = rows[0];
        const hargaSatuan = Number(produk.harga);
        const subtotal = hargaSatuan * line.qty;
        totalHarga += subtotal;
        itemEntities.push({
          produk_id: produk.id,
          nama_produk: produk.nama,
          qty: line.qty,
          harga_satuan: hargaSatuan,
          subtotal,
        });
      }

      const order = qr.manager.create(Order, {
        buyer_id: buyerId,
        toko_id: dto.toko_id,
        total_harga: totalHarga,
        shipping_address: dto.shipping_address,
        catatan: dto.catatan ?? null,
        status: OrderStatus.MENUNGGU,
      });
      const savedOrder = await qr.manager.save(Order, order);

      for (const item of itemEntities) {
        const orderItem = qr.manager.create(OrderItem, {
          ...item,
          order_id: savedOrder.id,
        });
        await qr.manager.save(OrderItem, orderItem);
      }

      await qr.commitTransaction();
      const created = (await this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['toko', 'buyer', 'items'],
      })) as Order;
      return withoutPrivateBuyerFields(created);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findMyOrders(buyerId: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: { buyer_id: buyerId },
      relations: ['toko', 'items'],
      order: { created_at: 'DESC' },
    });
  }

  async findSellerOrders(userId: string): Promise<Order[]> {
    const toko = await this.tokoRepo.findOne({ where: { user_id: userId } });
    if (!toko) {
      throw new NotFoundException('Anda belum memiliki toko');
    }
    const orders = await this.orderRepo.find({
      where: { toko_id: toko.id },
      relations: ['buyer', 'items'],
      order: { created_at: 'DESC' },
    });
    return orders.map(withoutPrivateBuyerFields);
  }

  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko', 'buyer', 'items', 'items.produk'],
    });
    if (!order) {
      throw new NotFoundException('Order tidak ditemukan');
    }
    if (order.buyer_id !== userId && order.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }
    return withoutPrivateBuyerFields(order);
  }

  async konfirmasi(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException(
        'Hanya penjual yang dapat mengkonfirmasi order',
      );
    }
    if (order.status !== OrderStatus.MENUNGGU) {
      throw new BadRequestException('Order tidak dalam status MENUNGGU');
    }
    order.status = OrderStatus.DIKONFIRMASI;
    return this.orderRepo.save(order);
  }

  async kirim(id: string, userId: string, dto: KirimOrderDto): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException(
        'Hanya penjual yang dapat memperbarui pengiriman',
      );
    }
    if (order.status !== OrderStatus.DIKONFIRMASI) {
      throw new BadRequestException(
        'Order harus dalam status DIKONFIRMASI untuk dikirim',
      );
    }
    order.status = OrderStatus.DIKIRIM;
    order.kurir_pengiriman = dto.kurir_pengiriman;
    order.nomor_resi = dto.nomor_resi;
    return this.orderRepo.save(order);
  }

  async selesai(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.buyer_id !== userId) {
      throw new ForbiddenException(
        'Hanya pembeli yang dapat menandai order selesai',
      );
    }
    if (order.status !== OrderStatus.DIKIRIM) {
      throw new BadRequestException(
        'Order harus dalam status DIKIRIM untuk diselesaikan',
      );
    }
    order.status = OrderStatus.SELESAI;
    return this.orderRepo.save(order);
  }

  async batalkan(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.toko.user_id === userId;
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    // Buyer: only from MENUNGGU. Seller: from MENUNGGU or DIKONFIRMASI.
    const allowed = isSeller
      ? [OrderStatus.MENUNGGU, OrderStatus.DIKONFIRMASI]
      : [OrderStatus.MENUNGGU];

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // The status check IS the conditional UPDATE (B4): of two concurrent
      // cancels only one changes the row, so stock is restored once.
      const cancelled = await qr.manager
        .createQueryBuilder()
        .update(Order)
        .set({ status: OrderStatus.DIBATALKAN })
        .where('id = :id', { id })
        .andWhere('status IN (:...allowed)', { allowed })
        .execute();

      if (!cancelled.affected) {
        const current = await qr.manager.findOne(Order, { where: { id } });
        throw new BadRequestException(
          `Order tidak dapat dibatalkan pada status ${current?.status ?? order.status}`,
        );
      }

      const items = await qr.manager.find(OrderItem, {
        where: { order_id: id },
        order: { produk_id: 'ASC' },
      });
      // Same merge + id order as create(), so restores and new orders lock
      // produk rows in the same order.
      for (const line of mergeOrderLines(items)) {
        await qr.manager
          .createQueryBuilder()
          .update(Produk)
          .set({ stok: () => 'stok + :qty' })
          .where('id = :id', { id: line.produk_id })
          .setParameter('qty', line.qty)
          .execute();
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return (await this.orderRepo.findOne({
      where: { id },
      relations: ['toko', 'items'],
    })) as Order;
  }
}
