import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Rotating refresh token (Phase 07). Only the SHA-256 hex hash of the raw
 * token is stored. All tokens of one login share a family_id; rotation
 * revokes the old row (reason 'rotated', replaced_by_id) and inserts a new
 * one in the same family.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_refresh_tokens',
  })
  id: string;

  @Index('IDX_refresh_tokens_user_id')
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_refresh_tokens_user_id',
  })
  user?: User;

  @Index('IDX_refresh_tokens_family_id')
  @Column({ type: 'uuid' })
  family_id: string;

  @Index('UQ_refresh_tokens_token_hash', { unique: true })
  @Column({ type: 'char', length: 64 })
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  revoked_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  replaced_by_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;
}
