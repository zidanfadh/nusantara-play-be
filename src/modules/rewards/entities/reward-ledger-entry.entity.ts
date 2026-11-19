import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type RewardCurrency = 'XP' | 'POINTS';

export const REWARD_CURRENCIES: readonly RewardCurrency[] = ['XP', 'POINTS'];

/**
 * One row of the append-only rewards ledger (Phase 15). A database trigger
 * refuses UPDATE, DELETE and TRUNCATE; corrections are new compensating rows
 * (rule_code ADMIN_ADJUST). Only RewardsService inserts rows.
 *
 * Names match migration 1795300000000. The (user_id, created_at DESC) index
 * is created by CreateRewardsLedger1795300000000.installDbObjects() (synchronize() cannot express
 * DESC), so it is declared here with synchronize: false.
 */
@Entity('reward_ledger')
@Check('CHK_reward_ledger_currency', `"currency" IN ('XP', 'POINTS')`)
@Index('IDX_reward_ledger_user_id_rule_code', ['user_id', 'rule_code'])
@Index('IDX_reward_ledger_user_id_created_at', { synchronize: false })
export class RewardLedgerEntry {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_reward_ledger',
  })
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_reward_ledger_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  currency: RewardCurrency;

  /** May be negative (corrections). */
  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'text' })
  rule_code: string;

  @Column({ type: 'text' })
  source_type: string;

  @Column({ type: 'text', nullable: true })
  source_id: string | null;

  @Column({ type: 'text', nullable: true })
  provinsi_kode: string | null;

  /** Built on the server only (reward-keys.ts), never from client input. */
  @Index('UQ_reward_ledger_idempotency_key', { unique: true })
  @Column({ type: 'text' })
  idempotency_key: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /** POINTS only: when the points become redeemable. */
  @Column({ type: 'timestamptz', nullable: true })
  available_at: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
