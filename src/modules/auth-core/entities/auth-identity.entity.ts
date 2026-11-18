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
 * External login identity (Phase 07), e.g. provider 'google' with the
 * Google account id. Used from the Google OAuth phase on.
 */
@Entity('auth_identities')
@Index('UQ_auth_identities_provider_user', ['provider', 'provider_user_id'], {
  unique: true,
})
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_auth_identities',
  })
  id: string;

  @Index('IDX_auth_identities_user_id')
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_auth_identities_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  provider: string;

  @Column({ type: 'text' })
  provider_user_id: string;

  @Column({ type: 'text' })
  email: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
