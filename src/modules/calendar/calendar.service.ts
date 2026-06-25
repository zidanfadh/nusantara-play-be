import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import {
    CalendarItem,
    CalendarItemType,
    CalendarItemVisibility,
} from './entities/calendar-item.entity';
import { CalendarInvite } from './entities/calendar-invite.entity';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { CreatePersonalScheduleDto } from './dto/create-personal-schedule.dto';
import { UpdateCalendarItemDto } from './dto/update-calendar-item.dto';
import { CalendarFilterDto, CalendarView, CalendarSourceFilter } from './dto/calendar-filter.dto';
import { AgendaFilterDto } from './dto/agenda-filter.dto';
import { ListCalendarItemsDto } from './dto/list-calendar-items.dto';
import { EventsService } from '../events/events.service';
import { DaerahService } from '../daerah/daerah.service';
import { User, UserRole } from '../users/entities/user.entity';
import { EventStatus } from '../events/entities/event.entity';

export interface CalendarEntry {
    id: string;
    title: string;
    description?: string;
    type: string; // 'important_date' | 'personal_schedule' | 'event'
    visibility: string;
    start_date: Date;
    end_date?: Date;
    all_day: boolean;
    color?: string;
    source: 'calendar' | 'event';
    daerah_id?: string;
    event_id?: string;
    created_by?: string;
}

export interface CalendarDayGroup {
    date: string; // YYYY-MM-DD
    entries: CalendarEntry[];
}

@Injectable()
export class CalendarService {
    constructor(
        @InjectRepository(CalendarItem)
        private calendarItemRepository: Repository<CalendarItem>,
        @InjectRepository(CalendarInvite)
        private calendarInviteRepository: Repository<CalendarInvite>,
        private eventsService: EventsService,
        private daerahService: DaerahService,
    ) { }

    // ─── Calendar View ──────────────────────────────────────────

    async getCalendar(
        filter: CalendarFilterDto,
        user?: User,
    ): Promise<{
        year: number;
        month: number;
        view: string;
        items: CalendarDayGroup[];
    }> {
        const { year, month, view } = filter;

        // Determine date range
        const { startDate, endDate } = this.getDateRange(year, month, view, filter.week);

        // Fetch calendar items
        const calendarItems =
            filter.source !== CalendarSourceFilter.EVENT
                ? await this.queryCalendarItems(startDate, endDate, filter, user)
                : [];

        // Fetch events if needed
        let eventEntries: CalendarEntry[] = [];
        if (filter.include_events !== false && filter.source !== CalendarSourceFilter.IMPORTANT_DATE && filter.source !== CalendarSourceFilter.PERSONAL_SCHEDULE) {
            eventEntries = await this.queryEventsForCalendar(startDate, endDate, filter.daerah_id, filter.search);
        }

        // Map calendar items to entries
        const calendarEntries: CalendarEntry[] = calendarItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            visibility: item.visibility,
            start_date: item.start_date,
            end_date: item.end_date,
            all_day: item.all_day,
            color: item.color,
            source: 'calendar' as const,
            daerah_id: item.daerah_id,
            event_id: item.event_id,
            created_by: item.created_by,
        }));

        // Merge and group by date
        const allEntries = [...calendarEntries, ...eventEntries].sort(
            (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
        );

        const grouped = this.groupByDate(allEntries, startDate, endDate);

        return {
            year,
            month,
            view: view || CalendarView.MONTHLY,
            items: grouped,
        };
    }

    async getAgenda(
        filter: AgendaFilterDto,
        user?: User,
    ): Promise<{
        data: CalendarEntry[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }> {
        const page = filter.page || 1;
        const limit = filter.limit || 20;

        const startDate = new Date(filter.startDate);
        const endDate = new Date(filter.endDate);

        // Fetch calendar items
        const calendarItems =
            filter.source !== CalendarSourceFilter.EVENT
                ? await this.queryCalendarItems(startDate, endDate, { ...filter, include_events: false } as any, user)
                : [];

        // Fetch events
        let eventEntries: CalendarEntry[] = [];
        if (filter.source !== CalendarSourceFilter.IMPORTANT_DATE && filter.source !== CalendarSourceFilter.PERSONAL_SCHEDULE) {
            eventEntries = await this.queryEventsForCalendar(startDate, endDate, filter.daerah_id, filter.search);
        }

        const calendarEntries: CalendarEntry[] = calendarItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            visibility: item.visibility,
            start_date: item.start_date,
            end_date: item.end_date,
            all_day: item.all_day,
            color: item.color,
            source: 'calendar' as const,
            daerah_id: item.daerah_id,
            event_id: item.event_id,
            created_by: item.created_by,
        }));

        const allEntries = [...calendarEntries, ...eventEntries].sort(
            (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
        );

        const total = allEntries.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedData = allEntries.slice((page - 1) * limit, page * limit);

        return {
            data: paginatedData,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    async getOne(id: string, user?: User): Promise<CalendarItem> {
        const item = await this.calendarItemRepository.findOne({
            where: { id },
            relations: ['daerah', 'creator', 'invites'],
        });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${id} not found`);
        }

        // Visibility check
        this.checkReadAccess(item, user);

        return item;
    }

    // ─── Important Dates CRUD ──────────────────────────────────

    async createImportantDate(dto: CreateImportantDateDto, user: User): Promise<CalendarItem> {
        // Validate visibility (important dates can only be public or internal)
        if (dto.visibility === CalendarItemVisibility.PRIVATE) {
            throw new BadRequestException('Important dates cannot be private. Use personal-schedule instead.');
        }

        // Kurator Daerah must set daerah_id to their own daerah
        if (user.role === UserRole.KURATOR_DAERAH) {
            if (!dto.daerah_id) {
                if (!user.daerah_id) {
                    throw new BadRequestException('Kurator Daerah must have daerah_id assigned');
                }
                dto.daerah_id = user.daerah_id;
            } else if (dto.daerah_id !== user.daerah_id) {
                throw new ForbiddenException('Kurator Daerah can only create important dates for their own daerah');
            }
        }

        // Validate daerah if provided
        if (dto.daerah_id) {
            try {
                await this.daerahService.findById(dto.daerah_id);
            } catch {
                throw new BadRequestException(`Invalid daerah_id: ${dto.daerah_id}`);
            }
        }

        const item = this.calendarItemRepository.create({
            ...dto,
            type: CalendarItemType.IMPORTANT_DATE,
            created_by: user.id,
        });

        return this.calendarItemRepository.save(item);
    }

    async getImportantDates(
        user: User,
        filter: ListCalendarItemsDto,
    ): Promise<{
        data: CalendarItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
    }> {
        const page = filter.page || 1;
        const limit = filter.limit || 20;

        const qb = this.calendarItemRepository
            .createQueryBuilder('item')
            .leftJoinAndSelect('item.daerah', 'daerah')
            .leftJoinAndSelect('item.creator', 'creator')
            .where('item.type = :type', { type: CalendarItemType.IMPORTANT_DATE })
            .orderBy('item.start_date', 'ASC');

        // Kurator only sees their own daerah's important dates + national ones (no daerah)
        if (user.role === UserRole.KURATOR_DAERAH) {
            qb.andWhere(
                new Brackets((sub) => {
                    sub
                        .where('item.daerah_id = :daerahId', { daerahId: user.daerah_id })
                        .orWhere('item.daerah_id IS NULL');
                }),
            );
        }

        const total = await qb.getCount();
        const data = await qb.skip((page - 1) * limit).take(limit).getMany();
        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    // ─── Personal Schedule CRUD ──────────────────────────────────

    async createPersonalSchedule(dto: CreatePersonalScheduleDto, user: User): Promise<CalendarItem> {
        // Validate visibility based on role
        if (dto.visibility === CalendarItemVisibility.PUBLIC && user.role !== UserRole.ADMIN_KPOTI) {
            throw new ForbiddenException('Only Admin KPOTI can create public personal schedules');
        }

        if (
            dto.visibility === CalendarItemVisibility.INTERNAL &&
            user.role === UserRole.PUBLIK
        ) {
            throw new ForbiddenException('Public users cannot create internal schedules');
        }

        const item = this.calendarItemRepository.create({
            ...dto,
            type: CalendarItemType.PERSONAL_SCHEDULE,
            visibility: dto.visibility || CalendarItemVisibility.PRIVATE,
            created_by: user.id,
        });

        return this.calendarItemRepository.save(item);
    }

    async getMyPersonalSchedule(
        userId: string,
        filter: ListCalendarItemsDto,
    ): Promise<{
        data: CalendarItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
    }> {
        const page = filter.page || 1;
        const limit = filter.limit || 20;

        const [data, total] = await this.calendarItemRepository.findAndCount({
            where: {
                type: CalendarItemType.PERSONAL_SCHEDULE,
                created_by: userId,
            },
            order: { start_date: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    // ─── Update & Delete ──────────────────────────────────────

    async update(id: string, dto: UpdateCalendarItemDto, user: User): Promise<CalendarItem> {
        const item = await this.calendarItemRepository.findOne({ where: { id } });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${id} not found`);
        }

        // Check ownership
        this.checkWriteAccess(item, user);

        // Validate visibility changes
        if (dto.visibility) {
            if (item.type === CalendarItemType.IMPORTANT_DATE && dto.visibility === CalendarItemVisibility.PRIVATE) {
                throw new BadRequestException('Important dates cannot be private');
            }
            if (item.type === CalendarItemType.PERSONAL_SCHEDULE) {
                if (dto.visibility === CalendarItemVisibility.PUBLIC && user.role !== UserRole.ADMIN_KPOTI) {
                    throw new ForbiddenException('Only Admin KPOTI can set public visibility');
                }
                if (dto.visibility === CalendarItemVisibility.INTERNAL && user.role === UserRole.PUBLIK) {
                    throw new ForbiddenException('Public users cannot set internal visibility');
                }
            }
        }

        // Validate daerah_id changes for kurator
        if (dto.daerah_id && user.role === UserRole.KURATOR_DAERAH && dto.daerah_id !== user.daerah_id) {
            throw new ForbiddenException('Kurator Daerah can only use their own daerah_id');
        }

        if (dto.daerah_id) {
            try {
                await this.daerahService.findById(dto.daerah_id);
            } catch {
                throw new BadRequestException(`Invalid daerah_id: ${dto.daerah_id}`);
            }
        }

        Object.assign(item, dto, { updated_by: user.id });
        return this.calendarItemRepository.save(item);
    }

    async remove(id: string, user: User): Promise<void> {
        const item = await this.calendarItemRepository.findOne({ where: { id } });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${id} not found`);
        }

        this.checkWriteAccess(item, user);

        await this.calendarItemRepository.remove(item);
    }

    // ─── Private Helpers ──────────────────────────────────────

    private getDateRange(
        year: number,
        month: number,
        view?: CalendarView,
        week?: number,
    ): { startDate: Date; endDate: Date } {
        if (view === CalendarView.WEEKLY && week) {
            // Calculate the start of the week within the month
            const monthStart = new Date(year, month - 1, 1);
            const dayOfWeek = monthStart.getDay(); // 0=Sun
            const weekStartDay = 1 + (week - 1) * 7 - dayOfWeek;
            const startDate = new Date(year, month - 1, weekStartDay);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            return { startDate, endDate };
        }

        // Monthly (default)
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        return { startDate, endDate };
    }

    private async queryCalendarItems(
        startDate: Date,
        endDate: Date,
        filter: CalendarFilterDto | AgendaFilterDto,
        user?: User,
    ): Promise<CalendarItem[]> {
        const qb = this.calendarItemRepository
            .createQueryBuilder('item')
            .leftJoinAndSelect('item.daerah', 'daerah')
            .where('item.start_date <= :endDate', { endDate })
            .andWhere(
                new Brackets((sub) => {
                    sub
                        .where('item.end_date >= :startDate', { startDate })
                        .orWhere('item.end_date IS NULL AND item.start_date >= :startDate', { startDate });
                }),
            );

        // Source filter
        if ('source' in filter && filter.source) {
            if (filter.source === CalendarSourceFilter.IMPORTANT_DATE) {
                qb.andWhere('item.type = :type', { type: CalendarItemType.IMPORTANT_DATE });
            } else if (filter.source === CalendarSourceFilter.PERSONAL_SCHEDULE) {
                qb.andWhere('item.type = :type', { type: CalendarItemType.PERSONAL_SCHEDULE });
            }
        }

        // Visibility filter
        if ('visibility' in filter && (filter as CalendarFilterDto).visibility) {
            qb.andWhere('item.visibility = :visFilter', { visFilter: (filter as CalendarFilterDto).visibility });
        }

        // Daerah filter
        const daerahId = 'daerah_id' in filter ? filter.daerah_id : undefined;
        if (daerahId) {
            qb.andWhere('item.daerah_id = :daerahId', { daerahId });
        }

        // Search filter
        const search = 'search' in filter ? filter.search : undefined;
        if (search) {
            qb.andWhere('(item.title ILIKE :search OR item.description ILIKE :search)', {
                search: `%${search}%`,
            });
        }

        // Visibility access control
        this.applyVisibilityFilter(qb, user);

        qb.orderBy('item.start_date', 'ASC');

        return qb.getMany();
    }

    private applyVisibilityFilter(
        qb: ReturnType<Repository<CalendarItem>['createQueryBuilder']>,
        user?: User,
    ): void {
        if (!user) {
            // Unauthenticated: only public
            qb.andWhere('item.visibility = :pubVis', { pubVis: CalendarItemVisibility.PUBLIC });
            return;
        }

        if (user.role === UserRole.PUBLIK) {
            // Public user: public items + own private items
            qb.andWhere(
                new Brackets((sub) => {
                    sub
                        .where('item.visibility = :pubVis', { pubVis: CalendarItemVisibility.PUBLIC })
                        .orWhere('(item.visibility = :privVis AND item.created_by = :userId)', {
                            privVis: CalendarItemVisibility.PRIVATE,
                            userId: user.id,
                        })
                        .orWhere(
                            `(item.visibility = :privVis2 AND EXISTS (
                SELECT 1 FROM calendar_invites ci
                WHERE ci.calendar_item_id = item.id
                AND ci.user_id = :userId2
                AND ci.status != 'declined'
              ))`,
                            { privVis2: CalendarItemVisibility.PRIVATE, userId2: user.id },
                        );
                }),
            );
        } else if (
            user.role === UserRole.ADMIN_KPOTI ||
            user.role === UserRole.KURATOR_DAERAH ||
            user.role === UserRole.PAKAR
        ) {
            // Internal users: public + internal + own private + invited private
            qb.andWhere(
                new Brackets((sub) => {
                    sub
                        .where('item.visibility IN (:...visibilities)', {
                            visibilities: [CalendarItemVisibility.PUBLIC, CalendarItemVisibility.INTERNAL],
                        })
                        .orWhere('(item.visibility = :privVis AND item.created_by = :userId)', {
                            privVis: CalendarItemVisibility.PRIVATE,
                            userId: user.id,
                        })
                        .orWhere(
                            `(item.visibility = :privVis2 AND EXISTS (
                SELECT 1 FROM calendar_invites ci
                WHERE ci.calendar_item_id = item.id
                AND ci.user_id = :userId2
                AND ci.status != 'declined'
              ))`,
                            { privVis2: CalendarItemVisibility.PRIVATE, userId2: user.id },
                        );
                }),
            );
        }
    }

    private async queryEventsForCalendar(
        startDate: Date,
        endDate: Date,
        daerahId?: string,
        search?: string,
    ): Promise<CalendarEntry[]> {
        const qb = this.calendarItemRepository.manager
            .createQueryBuilder()
            .select('event')
            .from('events', 'event')
            .where('event.status IN (:...statuses)', {
                statuses: [EventStatus.PUBLISHED, EventStatus.ONGOING, EventStatus.COMPLETED],
            })
            .andWhere('event.tanggal_mulai <= :endDate', { endDate })
            .andWhere('event.tanggal_selesai >= :startDate', { startDate });

        if (daerahId) {
            qb.andWhere('event.daerah_id = :daerahId', { daerahId });
        }

        if (search) {
            qb.andWhere('(event.nama ILIKE :search OR event.deskripsi ILIKE :search)', {
                search: `%${search}%`,
            });
        }

        qb.orderBy('event.tanggal_mulai', 'ASC');

        const events = await qb.getRawMany();

        return events.map((e) => ({
            id: e.event_id,
            title: e.event_nama,
            description: e.event_deskripsi,
            type: 'event',
            visibility: 'public',
            start_date: e.event_tanggal_mulai,
            end_date: e.event_tanggal_selesai,
            all_day: false,
            color: undefined,
            source: 'event' as const,
            daerah_id: e.event_daerah_id,
            event_id: e.event_id,
        }));
    }

    /**
     * Format a Date to YYYY-MM-DD using LOCAL timezone parts.
     * Using toISOString() would convert to UTC, causing off-by-one date
     * errors for timezones east of UTC (e.g. UTC+7 Indonesia).
     */
    private formatLocalDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private groupByDate(
        entries: CalendarEntry[],
        startDate: Date,
        endDate: Date,
    ): CalendarDayGroup[] {
        const map = new Map<string, CalendarEntry[]>();

        // Initialize all dates in range using local date parts (not UTC)
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        while (current <= rangeEnd) {
            map.set(this.formatLocalDate(current), []);
            current.setDate(current.getDate() + 1);
        }

        // Place entries into their dates
        for (const entry of entries) {
            const entryStart = new Date(entry.start_date);
            const entryEnd = entry.end_date ? new Date(entry.end_date) : entryStart;

            // Clamp to the visible range, compare by local date
            const clampedStart = entryStart < startDate ? startDate : entryStart;
            const clampedEnd = entryEnd > endDate ? endDate : entryEnd;

            const day = new Date(clampedStart.getFullYear(), clampedStart.getMonth(), clampedStart.getDate());
            const end = new Date(clampedEnd.getFullYear(), clampedEnd.getMonth(), clampedEnd.getDate());

            while (day <= end) {
                const dateKey = this.formatLocalDate(day);
                if (map.has(dateKey)) {
                    map.get(dateKey)!.push(entry);
                }
                day.setDate(day.getDate() + 1);
            }
        }

        // Convert to sorted array
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, entries]) => ({ date, entries }));
    }

    private checkReadAccess(item: CalendarItem, user?: User): void {
        if (item.visibility === CalendarItemVisibility.PUBLIC) return;

        if (!user) {
            throw new ForbiddenException('Authentication required to view this calendar item');
        }

        if (item.visibility === CalendarItemVisibility.INTERNAL) {
            if (user.role === UserRole.PUBLIK) {
                throw new ForbiddenException('You do not have access to this calendar item');
            }
            return;
        }

        // Private: only creator or invited users
        if (item.created_by === user.id) return;

        // Check if user is invited
        const isInvited = item.invites?.some(
            (invite) => invite.user_id === user.id && invite.status !== 'declined',
        );
        if (!isInvited) {
            throw new ForbiddenException('You do not have access to this calendar item');
        }
    }

    private checkWriteAccess(item: CalendarItem, user: User): void {
        // Admin can edit all
        if (user.role === UserRole.ADMIN_KPOTI) return;

        if (item.type === CalendarItemType.IMPORTANT_DATE) {
            // Kurator can edit important dates from their daerah
            if (user.role === UserRole.KURATOR_DAERAH) {
                if (item.created_by !== user.id && item.daerah_id !== user.daerah_id) {
                    throw new ForbiddenException('You can only edit important dates for your own daerah');
                }
                return;
            }
            throw new ForbiddenException('You do not have permission to edit this important date');
        }

        // Personal schedule: only owner
        if (item.created_by !== user.id) {
            throw new ForbiddenException('You can only edit your own personal schedule');
        }
    }
}
