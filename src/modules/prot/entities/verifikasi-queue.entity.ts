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

@Entity('verifikasi_queue')
export class VerifikasiQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'prot_id', unique: true })
  prot_id: string;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_pakar_id' })
  assigned_pakar_id: string | null;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'timestamp', nullable: true, name: 'assigned_at' })
  assigned_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_pakar_id' })
  assignedPakar: User | null;
}
