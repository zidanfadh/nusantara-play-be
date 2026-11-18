import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type PasswordAlgo = 'argon2id' | 'bcrypt';

/**
 * Password credential of a user (Phase 07). One row per user; users without
 * a password (Google-only, or not yet migrated from Supabase) have no row.
 * password_algo is a text column with a CHECK, not an enum type.
 */
@Entity('user_credentials')
@Check(
  'CHK_user_credentials_password_algo',
  `"password_algo" IN ('argon2id', 'bcrypt')`,
)
export class UserCredential {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_credentials',
  })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_credentials_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  password_hash: string;

  @Column({ type: 'text' })
  password_algo: PasswordAlgo;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'int', default: 0 })
  failed_login_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  password_changed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
