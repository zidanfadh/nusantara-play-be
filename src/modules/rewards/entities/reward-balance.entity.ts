import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Current XP / Points / level of a user (Phase 15). Derived from
 * reward_ledger and updated in the same transaction as every ledger insert
 * (RewardsService). `npm run rewards:reconcile` recomputes it from the ledger.
 * Names match migration 1795300000000.
 */
@Entity('reward_balances')
export class RewardBalance {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_reward_balances',
  })
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_reward_balances_user_id',
  })
  user?: User;

  @Column({ type: 'integer', default: 0 })
  xp_total: number;

  @Column({ type: 'integer', default: 0 })
  points_total: number;

  /**
   * POINTS with available_at <= now at the last update of this row. Read
   * endpoints compute the live value from the ledger; this is only a cache.
   */
  @Column({ type: 'integer', default: 0 })
  points_available_cache: number;

  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}
