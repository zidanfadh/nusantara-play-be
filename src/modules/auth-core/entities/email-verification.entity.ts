import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type EmailVerificationMethod = 'email_link' | 'google';

/**
 * Verified email of an account WITHOUT a password (Phase 09): Supabase-only
 * accounts that clicked a verification link, and (Phase 10) Google-only
 * accounts whose Google email is verified. Accounts with user_credentials
 * keep using user_credentials.email_verified_at.
 *
 * "Email verified" = user_credentials.email_verified_at IS NOT NULL OR a row
 * here (see email-verification.ts). Names match migration 1795200000000.
 */
@Entity('email_verifications')
@Check(
  'CHK_email_verifications_method',
  `"method" IN ('email_link', 'google')`,
)
export class EmailVerification {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_email_verifications',
  })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_email_verifications_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  method: EmailVerificationMethod;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  verified_at: Date;
}
