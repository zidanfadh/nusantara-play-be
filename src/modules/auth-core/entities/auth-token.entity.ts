import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type AuthTokenType = 'email_verification' | 'password_reset';

export const AUTH_TOKEN_TYPES = {
  emailVerification: 'email_verification',
  passwordReset: 'password_reset',
} as const satisfies Record<string, AuthTokenType>;

/**
 * One-time email token (Phase 09): email verification or password reset.
 * Only the SHA-256 hex hash of the raw token is stored. `type` is text with a
 * CHECK, not an enum type. Names match migration 1795200000000.
 */
@Entity('auth_tokens')
@Check(
  'CHK_auth_tokens_type',
  `"type" IN ('email_verification', 'password_reset')`,
)
@Index('IDX_auth_tokens_user_id_type', ['user_id', 'type'])
export class AuthToken {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_auth_tokens' })
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_auth_tokens_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  type: AuthTokenType;

  @Index('UQ_auth_tokens_token_hash', { unique: true })
  @Column({ type: 'char', length: 64 })
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'inet', nullable: true })
  requested_ip: string | null;
}
