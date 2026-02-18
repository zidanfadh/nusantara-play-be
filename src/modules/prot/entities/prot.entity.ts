import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const JsonArrayTransformer: ValueTransformer = {
  to(value: any): any {
    return JSON.stringify(value);
  },
  from(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    // Handle both string and already parsed JSON
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

export enum PROTJenis {
  PERMAINAN_RAKYAT = 'PERMAINAN_RAKYAT',
  OLAHRAGA_TRADISIONAL = 'OLAHRAGA_TRADISIONAL',
}

export enum TargetUsia {
  ANAK = 'ANAK',
  REMAJA = 'REMAJA',
  DEWASA = 'DEWASA',
  SEMUA_USIA = 'SEMUA_USIA',
}

export enum PROTStatus {
  DRAFT = 'DRAFT',
  DIKURASI = 'DIKURASI',
  REVISI = 'REVISI',
  DIVERIFIKASI = 'DIVERIFIKASI',
  ARSIP_NASIONAL = 'ARSIP_NASIONAL',
}

export interface Peralatan {
  nama: string;
  deskripsi?: string;
  kisaranHarga?: string;
  fotoAlat?: string[];
  urlPembelian?: string[];
}

@Entity('prot')
export class PROT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column({
    type: 'enum',
    enum: PROTJenis,
  })
  jenis: PROTJenis;

  @Column({ type: 'text', nullable: true })
  statusAsalUsul: string;

  @Column({ nullable: true })
  provinsiKode: string;

  @Column({ nullable: true })
  kabkotaKode: string;

  @Column({ nullable: true })
  kecamatanKode: string;

  @Column({ nullable: true })
  desaKode: string;

  @Column({ nullable: true })
  alamatLengkap: string;

  @Column({ type: 'text', nullable: true })
  caraBermain: string;

  @Column({ type: 'text', nullable: true })
  nilaiMoral: string;

  @Column({
    type: 'enum',
    enum: TargetUsia,
  })
  targetUsia: TargetUsia;

  @Column({
    type: 'jsonb',
    nullable: true,
    transformer: JsonArrayTransformer,
  })
  peralatan: Peralatan[];

  @Column({
    type: 'jsonb',
    nullable: true,
    transformer: JsonArrayTransformer,
  })
  fotoKegiatan: string[];

  @Column({
    type: 'jsonb',
    nullable: true,
    transformer: JsonArrayTransformer,
  })
  videoKegiatan: string[];

  @Column({
    name: 'dokumen_kurikulum',
    type: 'jsonb',
    nullable: true,
    transformer: JsonArrayTransformer,
  })
  dokumenKurikulum: string[];

  @Column({
    type: 'enum',
    enum: PROTStatus,
    default: PROTStatus.DRAFT,
  })
  status: PROTStatus;

  @Column({ type: 'uuid', name: 'created_by' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true, name: 'verified_by' })
  verified_by: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'published_by' })
  published_by: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'submitted_at' })
  submitted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verified_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'published_at' })
  published_at: Date | null;

  // Relations
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedBy: User | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
