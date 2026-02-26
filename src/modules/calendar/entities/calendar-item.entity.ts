import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Daerah } from '../../daerah/entities/daerah.entity';
import { Event } from '../../events/entities/event.entity';
import { CalendarInvite } from './calendar-invite.entity';

export enum CalendarItemType {
    IMPORTANT_DATE = 'important_date',
    PERSONAL_SCHEDULE = 'personal_schedule',
}

export enum CalendarItemVisibility {
    PUBLIC = 'public',
    INTERNAL = 'internal',
    PRIVATE = 'private',
}

@Entity('calendar_items')
export class CalendarItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'title' })
    title: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string;

    @Column({
        name: 'type',
        type: 'enum',
        enum: CalendarItemType,
    })
    type: CalendarItemType;

    @Column({
        name: 'visibility',
        type: 'enum',
        enum: CalendarItemVisibility,
        default: CalendarItemVisibility.PUBLIC,
    })
    visibility: CalendarItemVisibility;

    @Column({ name: 'start_date', type: 'timestamp' })
    start_date: Date;

    @Column({ name: 'end_date', type: 'timestamp', nullable: true })
    end_date: Date;

    @Column({ name: 'all_day', default: true })
    all_day: boolean;

    @Column({ name: 'color', length: 20, nullable: true })
    color: string;

    @Column({ name: 'daerah_id', type: 'uuid', nullable: true })
    daerah_id: string;

    @Column({ name: 'event_id', type: 'uuid', nullable: true, unique: true })
    event_id: string;

    @Column({ name: 'created_by' })
    created_by: string;

    @Column({ name: 'updated_by', nullable: true })
    updated_by: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;

    // Relations
    @ManyToOne(() => Daerah, { nullable: true })
    @JoinColumn({ name: 'daerah_id' })
    daerah: Daerah;

    @ManyToOne(() => Event, { nullable: true })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'updated_by' })
    updatedByUser: User | null;

    @OneToMany(() => CalendarInvite, (invite) => invite.calendarItem)
    invites: CalendarInvite[];
}
