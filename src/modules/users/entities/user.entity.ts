import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN_KPOTI = 'admin_kpoti',
  KURATOR_DAERAH = 'kurator_daerah',
  PAKAR = 'pakar',
  PUBLIK = 'publik',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  supabase_user_id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  full_name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PUBLIK,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'uuid', nullable: true })
  daerah_id: string | null;

  @Column({ nullable: true })
  institution: string;

  @Column({ type: 'text', array: true, nullable: true })
  expertise: string[];

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string;
}
