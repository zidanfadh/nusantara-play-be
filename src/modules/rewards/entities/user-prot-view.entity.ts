import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * First view of a PROT (status ARSIP_NASIONAL) by a user (Phase 15, rule
 * PROT_VIEW). provinsi_kode is copied from the PROT row at view time (never
 * from the client). No foreign key to prot: a view stays recorded even if
 * the PROT is later unpublished or deleted. Names match migration
 * 1795300000000.
 */
@Entity('user_prot_views')
@Index('IDX_user_prot_views_user_id_provinsi_kode', [
  'user_id',
  'provinsi_kode',
])
export class UserProtView {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_prot_views',
  })
  user_id: string;

  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_prot_views',
  })
  prot_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_prot_views_user_id',
  })
  user?: User;

  @Column({ type: 'text' })
  provinsi_kode: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  first_viewed_at: Date;
}
