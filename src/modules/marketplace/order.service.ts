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
import { CreateOrderDto } from './dto/create-order.dto';
import { KirimOrderDto } from './dto/kirim-order.dto';

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
      const toko = await qr.manager.findOne(Toko, { where: { id: dto.toko_id } });
      if (!toko) {
        throw new NotFoundException('Toko tidak ditemukan');
      }
      if (toko.user_id === buyerId) {
        throw new BadRequestException('Anda tidak dapat membeli dari toko sendiri');
      }

      let totalHarga = 0;
      const itemEntities: Partial<OrderItem>[] = [];

      for (const item of dto.items) {
        const produk = await qr.manager.findOne(Produk, {
          where: { id: item.produk_id, toko_id: dto.toko_id, is_active: true },
        });
        if (!produk) {
          throw new NotFoundException(`Produk '${item.produk_id}' tidak ditemukan di toko ini`);
        }
        if (produk.stok < item.qty) {
          throw new BadRequestException(`Stok produk '${produk.nama}' tidak mencukupi`);
        }
        produk.stok -= item.qty;
        await qr.manager.save(Produk, produk);

        const subtotal = Number(produk.harga) * item.qty;
        totalHarga += subtotal;
        itemEntities.push({
          produk_id: produk.id,
          nama_produk: produk.nama,
          qty: item.qty,
          harga_satuan: Number(produk.harga),
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
        const orderItem = qr.manager.create(OrderItem, { ...item, order_id: savedOrder.id });
        await qr.manager.save(OrderItem, orderItem);
      }

      await qr.commitTransaction();
      return this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['toko', 'buyer', 'items'],
      });
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
    return this.orderRepo.find({
      where: { toko_id: toko.id },
      relations: ['buyer', 'items'],
      order: { created_at: 'DESC' },
    });
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
    return order;
  }

  async konfirmasi(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException('Hanya penjual yang dapat mengkonfirmasi order');
    }
    if (order.status !== OrderStatus.MENUNGGU) {
      throw new BadRequestException('Order tidak dalam status MENUNGGU');
    }
    order.status = OrderStatus.DIKONFIRMASI;
    return this.orderRepo.save(order);
  }

  async kirim(id: string, userId: string, dto: KirimOrderDto): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException('Hanya penjual yang dapat memperbarui pengiriman');
    }
    if (order.status !== OrderStatus.DIKONFIRMASI) {
      throw new BadRequestException('Order harus dalam status DIKONFIRMASI untuk dikirim');
    }
    order.status = OrderStatus.DIKIRIM;
    order.kurir_pengiriman = dto.kurir_pengiriman;
    order.nomor_resi = dto.nomor_resi;
    return this.orderRepo.save(order);
  }

  async selesai(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.buyer_id !== userId) {
      throw new ForbiddenException('Hanya pembeli yang dapat menandai order selesai');
    }
    if (order.status !== OrderStatus.DIKIRIM) {
      throw new BadRequestException('Order harus dalam status DIKIRIM untuk diselesaikan');
    }
    order.status = OrderStatus.SELESAI;
    return this.orderRepo.save(order);
  }

  async batalkan(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko', 'items'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.toko.user_id === userId;
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    const cancellableByBuyer = isBuyer && order.status === OrderStatus.MENUNGGU;
    const cancellableBySeller =
      isSeller &&
      (order.status === OrderStatus.MENUNGGU || order.status === OrderStatus.DIKONFIRMASI);
    if (!cancellableByBuyer && !cancellableBySeller) {
      throw new BadRequestException(
        `Order tidak dapat dibatalkan pada status ${order.status}`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const item of order.items) {
        const produk = await qr.manager.findOne(Produk, { where: { id: item.produk_id } });
        if (produk) {
          produk.stok += item.qty;
          await qr.manager.save(Produk, produk);
        }
      }
      order.status = OrderStatus.DIBATALKAN;
      await qr.manager.save(Order, order);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return order;
  }
}
