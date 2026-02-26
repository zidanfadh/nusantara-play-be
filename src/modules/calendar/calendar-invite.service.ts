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

@Injectable()
export class CalendarInviteService {
    constructor(
        @InjectRepository(CalendarInvite)
        private inviteRepository: Repository<CalendarInvite>,
        @InjectRepository(CalendarItem)
        private calendarItemRepository: Repository<CalendarItem>,
    ) { }

    async inviteUsers(
        calendarItemId: string,
        userIds: string[],
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

        // Cannot invite yourself
        const filteredUserIds = userIds.filter((id) => id !== invitedBy.id);

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

    async getMyInvites(userId: string): Promise<CalendarInvite[]> {
        return this.inviteRepository.find({
            where: {
                user_id: userId,
            },
            relations: ['calendarItem', 'calendarItem.creator', 'invitedByUser'],
            order: { created_at: 'DESC' },
        });
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

    async getInvitesForItem(calendarItemId: string, requestor: User): Promise<CalendarInvite[]> {
        const item = await this.calendarItemRepository.findOne({
            where: { id: calendarItemId },
        });

        if (!item) {
            throw new NotFoundException(`Calendar item with ID ${calendarItemId} not found`);
        }

        if (item.created_by !== requestor.id) {
            throw new ForbiddenException('Only the creator can view invites for this item');
        }

        return this.inviteRepository.find({
            where: { calendar_item_id: calendarItemId },
            relations: ['user'],
            order: { created_at: 'ASC' },
        });
    }
}
