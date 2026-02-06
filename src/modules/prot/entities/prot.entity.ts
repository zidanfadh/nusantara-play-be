import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
