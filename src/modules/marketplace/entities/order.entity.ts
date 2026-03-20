import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Toko } from './toko.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  MENUNGGU = 'menunggu',
  DIKONFIRMASI = 'dikonfirmasi',
  DIKIRIM = 'dikirim',
  SELESAI = 'selesai',
  DIBATALKAN = 'dibatalkan',
}

export interface ShippingAddress {
  nama_penerima: string;
  phone: string;
  alamat_lengkap: string;
  kota: string;
  provinsi: string;
  kode_pos?: string;
}

@Entity('marketplace_order')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'buyer_id', type: 'uuid' })
  buyer_id: string;

  @Column({ name: 'toko_id', type: 'uuid' })
  toko_id: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.MENUNGGU })
  status: OrderStatus;

  @Column({ name: 'total_harga', type: 'decimal', precision: 15, scale: 2 })
  total_harga: number;

  @Column({ name: 'shipping_address', type: 'jsonb' })
  shipping_address: ShippingAddress;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({ name: 'kurir_pengiriman', nullable: true })
  kurir_pengiriman: string | null;

  @Column({ name: 'nomor_resi', nullable: true })
  nomor_resi: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @ManyToOne(() => Toko, { nullable: false })
  @JoinColumn({ name: 'toko_id' })
  toko: Toko;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
