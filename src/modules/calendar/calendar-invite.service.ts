import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CalendarInvite, CalendarInviteStatus } from './entities/calendar-invite.entity';
import { CalendarItem, CalendarItemVisibility } from './entities/calendar-item.entity';
import { User } from '../users/entities/user.entity';
import { ListInvitesDto } from './dto/list-invites.dto';
import { InviteUsersDto } from './dto/invite-users.dto';

export interface PaginatedInvites {
    data: CalendarInvite[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

@Injectable()
export class CalendarInviteService {
    constructor(
        @InjectRepository(CalendarInvite)
        private inviteRepository: Repository<CalendarInvite>,
        @InjectRepository(CalendarItem)
        private calendarItemRepository: Repository<CalendarItem>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async inviteUsers(
        calendarItemId: string,
        dto: InviteUsersDto,
        invitedBy: User,
    ): Promise<CalendarInvite[]> {
        const item = await this.calendarItemRepository.findOne({
            where: { id: calendarItemId },
        });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${calendarItemId} not found`);
        }

        // Only the creator can invite
        if (item.created_by !== invitedBy.id) {
            throw new ForbiddenException('Only the creator of a calendar item can invite users');
        }

        // Only internal/private items can have invites
        if (item.visibility === CalendarItemVisibility.PUBLIC) {
            throw new BadRequestException('Public calendar items do not need invites — they are visible to everyone');
        }

        if (!dto.user_ids?.length && !dto.emails?.length) {
            throw new BadRequestException('Provide at least one user_id or email to invite');
        }

        // Resolve emails to user IDs
        let resolvedFromEmail: string[] = [];
        if (dto.emails?.length) {
            const usersFound = await this.userRepository.find({
                where: { email: In(dto.emails) },
                select: ['id', 'email'],
            });

            const foundEmails = usersFound.map((u) => u.email);
            const notFound = dto.emails.filter((e) => !foundEmails.includes(e));
            if (notFound.length > 0) {
                throw new BadRequestException(
                    `The following emails are not registered: ${notFound.join(', ')}`,
                );
            }

            resolvedFromEmail = usersFound.map((u) => u.id);
        }

        // Merge user_ids + resolved from emails (deduplicate)
        const allUserIds = [...new Set([...(dto.user_ids ?? []), ...resolvedFromEmail])];

        // Cannot invite yourself
        const filteredUserIds = allUserIds.filter((id) => id !== invitedBy.id);

        if (filteredUserIds.length === 0) {
            throw new BadRequestException('No valid users to invite');
        }

        // Check for existing invites
        const existingInvites = await this.inviteRepository.find({
            where: {
                calendar_item_id: calendarItemId,
                user_id: In(filteredUserIds),
            },
        });

        const existingUserIds = new Set(existingInvites.map((i) => i.user_id));
        const newUserIds = filteredUserIds.filter((id) => !existingUserIds.has(id));

        if (newUserIds.length === 0) {
            return existingInvites;
        }

        const newInvites = newUserIds.map((userId) =>
            this.inviteRepository.create({
                calendar_item_id: calendarItemId,
                user_id: userId,
                invited_by: invitedBy.id,
                status: CalendarInviteStatus.PENDING,
            }),
        );

        const saved = await this.inviteRepository.save(newInvites);
        return [...existingInvites, ...saved];
    }

    async removeInvite(
        calendarItemId: string,
        userId: string,
        requestor: User,
    ): Promise<void> {
        const item = await this.calendarItemRepository.findOne({
            where: { id: calendarItemId },
        });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${calendarItemId} not found`);
        }

        if (item.created_by !== requestor.id) {
            throw new ForbiddenException('Only the creator can remove invites');
        }

        const invite = await this.inviteRepository.findOne({
            where: { calendar_item_id: calendarItemId, user_id: userId },
        });

        if (!invite) {
            throw new NotFoundException('Invite not found');
        }

        await this.inviteRepository.remove(invite);
    }

    async getMyInvites(userId: string, filter: ListInvitesDto): Promise<PaginatedInvites> {
        const page = filter.page || 1;
        const limit = filter.limit || 20;

        const where: Record<string, unknown> = { user_id: userId };
        if (filter.status) {
            where.status = filter.status;
        }

        const [data, total] = await this.inviteRepository.findAndCount({
            where,
            relations: ['calendarItem', 'calendarItem.creator', 'invitedByUser'],
            order: { created_at: 'DESC' },
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

    async updateInviteStatus(
        inviteId: string,
        status: CalendarInviteStatus,
        userId: string,
    ): Promise<CalendarInvite> {
        const invite = await this.inviteRepository.findOne({
            where: { id: inviteId },
            relations: ['calendarItem'],
        });

        if (!invite) {
            throw new NotFoundException(`Invite with ID ${inviteId} not found`);
        }

        if (invite.user_id !== userId) {
            throw new ForbiddenException('You can only update your own invites');
        }

        if (status === CalendarInviteStatus.PENDING) {
            throw new BadRequestException('Cannot set status back to pending');
        }

        invite.status = status;
        return this.inviteRepository.save(invite);
    }

    async getInvitesForItem(
        calendarItemId: string,
        requestor: User,
        filter: ListInvitesDto,
    ): Promise<PaginatedInvites> {
        const item = await this.calendarItemRepository.findOne({
            where: { id: calendarItemId },
        });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${calendarItemId} not found`);
        }

        if (item.created_by !== requestor.id) {
            throw new ForbiddenException('Only the creator can view invites for this item');
        }

        const page = filter.page || 1;
        const limit = filter.limit || 20;

        const where: Record<string, unknown> = { calendar_item_id: calendarItemId };
        if (filter.status) {
            where.status = filter.status;
        }

        const [data, total] = await this.inviteRepository.findAndCount({
            where,
            relations: ['user'],
            order: { created_at: 'ASC' },
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
}
