import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Produk } from './produk.entity';

@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  order_id: string;

  @Column({ name: 'produk_id', type: 'uuid' })
  produk_id: string;

  @Column({ name: 'nama_produk' })
  nama_produk: string;

  @Column({ type: 'int' })
  qty: number;

  @Column({ name: 'harga_satuan', type: 'decimal', precision: 15, scale: 2 })
  harga_satuan: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: number;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Produk, { nullable: false })
  @JoinColumn({ name: 'produk_id' })
  produk: Produk;
}
