import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PROT } from '../../prot/entities/prot.entity';
import { Verifikasi } from '../../prot/entities/verifikasi.entity';

export enum BlockchainProofStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Unique(['prot_id', 'version'])
@Entity('blockchain_proof')
export class BlockchainProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'verifikasi_id' })
  verifikasi_id: string;

  @Column({ type: 'uuid', name: 'prot_id' })
  prot_id: string;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'text', name: 'data_hash' })
  data_hash: string;

  @Column({ type: 'text', nullable: true, name: 'tx_hash' })
  tx_hash: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'block_number' })
  block_number: string | null;

  @Column({ type: 'text', name: 'blockchain_network', default: 'polygon-amoy' })
  blockchain_network: string;

  @Column({ type: 'text', default: BlockchainProofStatus.PENDING })
  status: BlockchainProofStatus;

  @Column({ type: 'integer', default: 0, name: 'retry_count' })
  retry_count: number;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  last_error: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'anchored_at' })
  anchored_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Verifikasi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verifikasi_id' })
  verifikasi: Verifikasi;

  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;
}
