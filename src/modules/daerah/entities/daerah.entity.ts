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
}

@Entity('daerah')
export class Daerah {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column({ unique: true })
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
