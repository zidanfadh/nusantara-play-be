import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Paspor stamp of a province (Phase 15, rule PASPOR_STAMP), at most one per
 * user and province. Names match migration 1795300000000.
 */
@Entity('user_province_stamps')
export class UserProvinceStamp {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_province_stamps',
  })
  user_id: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_province_stamps',
  })
  provinsi_kode: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_province_stamps_user_id',
  })
  user?: User;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  stamped_at: Date;
}
