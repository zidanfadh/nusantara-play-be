import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

export interface Peralatan {
  nama: string;
  deskripsi?: string;
  kisaranHarga?: string;
  fotoAlat?: string[];
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

  @Column({ type: 'jsonb', nullable: true })
  peralatan: Peralatan[];

  @Column({ type: 'jsonb', nullable: true })
  fotoKegiatan: string[];

  @Column({ type: 'jsonb', nullable: true })
  videoKegiatan: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
