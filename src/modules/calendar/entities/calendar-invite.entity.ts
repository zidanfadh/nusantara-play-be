import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CalendarItem } from './calendar-item.entity';

export enum CalendarInviteStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
}

@Entity('calendar_invites')
export class CalendarInvite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'calendar_item_id', type: 'uuid' })
    calendar_item_id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    user_id: string;

    @Column({
        name: 'status',
        type: 'enum',
        enum: CalendarInviteStatus,
        default: CalendarInviteStatus.PENDING,
    })
    status: CalendarInviteStatus;

    @Column({ name: 'invited_by', type: 'uuid' })
    invited_by: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;

    // Relations
    @ManyToOne(() => CalendarItem, (item) => item.invites, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'calendar_item_id' })
    calendarItem: CalendarItem;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'invited_by' })
    invitedByUser: User;
}
