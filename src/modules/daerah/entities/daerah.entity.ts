import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DaerahLevel {
  PROVINSI = 'provinsi',
  KABUPATEN = 'kabupaten',
  KOTA = 'kota',
  KECAMATAN = 'kecamatan',
  KELURAHAN = 'kelurahan',
  DESA = 'desa',
}

@Entity('daerah')
export class Daerah {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column({ type: 'varchar', length: 15, unique: true })
  kode: string;

  @Column()
  provinsi: string;

  @Column({
    type: 'enum',
    enum: DaerahLevel,
  })
  level: DaerahLevel;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  prefix: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
