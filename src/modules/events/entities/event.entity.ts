import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ValueTransformer,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Daerah } from '../../daerah/entities/daerah.entity';

export enum EventJenis {
  TERAS_BERMAIN = 'teras_bermain',
  WORKSHOP = 'workshop',
  FESTIVAL = 'festival',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

const JsonTransformer: ValueTransformer = {
  to(value: any): any {
    return JSON.stringify(value);
  },
  from(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nama' })
  nama: string;

  @Column({ name: 'deskripsi', type: 'text' })
  deskripsi: string;

  @Column({
    name: 'jenis',
    type: 'enum',
    enum: EventJenis,
  })
  jenis: EventJenis;

  @Column({
    name: 'status',
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ name: 'tanggal_mulai', type: 'timestamp' })
  tanggal_mulai: Date;

  @Column({ name: 'tanggal_selesai', type: 'timestamp' })
  tanggal_selesai: Date;

  @Column({ name: 'lokasi' })
  lokasi: string;

  @Column({ name: 'daerah_id' })
  daerah_id: string;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ name: 'kuota_peserta', nullable: true })
  kuota_peserta: number;

  @Column({ name: 'jumlah_peserta', default: 0 })
  jumlah_peserta: number;

  @Column({ name: 'banner_url', nullable: true })
  banner_url: string;

  @Column({
    name: 'galeri_foto',
    type: 'jsonb',
    nullable: true,
    transformer: JsonTransformer,
  })
  galeri_foto: string[];

  @Column({ name: 'persyaratan', type: 'text', nullable: true })
  persyaratan: string;

  @Column({
    name: 'formulir_custom',
    type: 'jsonb',
    nullable: true,
    transformer: JsonTransformer,
  })
  formulir_custom: Record<string, any>;

  @Column({ name: 'contact_person', nullable: true })
  contact_person: string;

  @Column({ name: 'contact_phone', nullable: true })
  contact_phone: string;

  @Column({ name: 'contact_email', nullable: true })
  contact_email: string;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'created_by' })
  created_by: string;

  @Column({ name: 'updated_by', nullable: true })
  updated_by: string;

  // Relations
  @ManyToOne(() => Daerah, { nullable: false })
  @JoinColumn({ name: 'daerah_id' })
  daerah: Daerah;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  organizer: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User | null;
}
