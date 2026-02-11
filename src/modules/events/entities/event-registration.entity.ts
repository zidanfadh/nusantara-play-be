import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from '../../users/entities/user.entity';

export enum RegistrationStatus {
  REGISTERED = 'registered',
  CHECKED_IN = 'checked_in',
  CANCELLED = 'cancelled',
}

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  event_id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @Column({
    name: 'data_pendaftaran',
    type: 'jsonb',
  })
  data_pendaftaran: Record<string, any>;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.REGISTERED,
  })
  status: RegistrationStatus;

  @Column({ name: 'checked_in_at', type: 'timestamp', nullable: true })
  checked_in_at: Date;

  @Column({ name: 'certificate_id', type: 'uuid', nullable: true })
  certificate_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Event, { nullable: false })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
