import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PROT } from './prot.entity';
import { User } from '../../users/entities/user.entity';

export enum VerifikasiStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_NEEDED = 'REVISION_NEEDED',
}

@Entity('verifikasi')
export class Verifikasi {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'prot_id' })
  prot_id: string;

  @Column({ type: 'uuid', name: 'pakar_id' })
  pakar_id: string;

  @Column({
    type: 'enum',
    enum: VerifikasiStatus,
    default: VerifikasiStatus.PENDING,
  })
  status: VerifikasiStatus;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({ type: 'text', nullable: true, name: 'saran_perbaikan' })
  saran_perbaikan: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'dokumen_pendukung',
    transformer: {
      to: (value: string[] | null) => (value ? JSON.stringify(value) : null),
      from: (value: string | null) => (value ? JSON.parse(value) : null),
    },
  })
  dokumen_pendukung: string[] | null;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verified_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'pakar_id' })
  pakar: User;
}
