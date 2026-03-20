import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  ValueTransformer,
} from 'typeorm';
import { Toko } from './toko.entity';
import { KategoriProduk } from './kategori-produk.entity';
import { PROT } from '../../prot/entities/prot.entity';

const JsonArrayTransformer: ValueTransformer = {
  to: (value: any) => JSON.stringify(value),
  from: (value: any) => {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

@Entity('produk')
export class Produk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'toko_id', type: 'uuid' })
  toko_id: string;

  @Column({ name: 'kategori_id', type: 'uuid', nullable: true })
  kategori_id: string | null;

  @Column()
  nama: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  deskripsi: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  harga: number;

  @Column({ type: 'int', default: 0 })
  stok: number;

  @Column({ type: 'jsonb', nullable: true, transformer: JsonArrayTransformer })
  images: string[] | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Toko, { nullable: false })
  @JoinColumn({ name: 'toko_id' })
  toko: Toko;

  @ManyToOne(() => KategoriProduk, { nullable: true })
  @JoinColumn({ name: 'kategori_id' })
  kategori: KategoriProduk | null;

  @ManyToMany(() => PROT)
  @JoinTable({
    name: 'produk_prot',
    joinColumn: { name: 'produk_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'prot_id', referencedColumnName: 'id' },
  })
  prots: PROT[];
}
