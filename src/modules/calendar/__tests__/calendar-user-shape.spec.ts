/**
 * Phase 06, P1: calendar responses never expose private user fields.
 * - GET /calendar/:id is @Public(): the creator only in the public shape.
 * - Logged-in endpoints that show other users (important dates, invites)
 *   strip supabase_user_id and last_login_at.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalendarService } from '../calendar.service';
import { CalendarInviteService } from '../calendar-invite.service';
import {
  CalendarItem,
  CalendarItemType,
  CalendarItemVisibility,
} from '../entities/calendar-item.entity';
import { CalendarInvite } from '../entities/calendar-invite.entity';
import { EventsService } from '../../events/events.service';
import { DaerahService } from '../../daerah/daerah.service';
import { User, UserRole } from '../../users/entities/user.entity';

const privateUser = (id: string) => ({
  id,
  full_name: `User ${id}`,
  email: `${id}@example.test`,
  phone: '+62 800 0000 0000',
  supabase_user_id: '00000000-0000-0000-0000-000000000005',
  last_login_at: new Date(),
  avatar_url: null,
  institution: 'KPOTI',
  role: UserRole.KURATOR_DAERAH,
});

const PRIVATE_KEYS = ['supabase_user_id', 'last_login_at'];
const PUBLIC_FORBIDDEN_KEYS = [...PRIVATE_KEYS, 'email', 'phone'];

describe('Calendar user shapes (P1)', () => {
  let calendarService: CalendarService;
  let inviteService: CalendarInviteService;
  const itemRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
  const inviteRepo = { findAndCount: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        CalendarInviteService,
        { provide: getRepositoryToken(CalendarItem), useValue: itemRepo },
        { provide: getRepositoryToken(CalendarInvite), useValue: inviteRepo },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: EventsService, useValue: {} },
        { provide: DaerahService, useValue: {} },
      ],
    }).compile();
    calendarService = module.get(CalendarService);
    inviteService = module.get(CalendarInviteService);
  });

  it('getOne (public) returns the creator in the public shape only', async () => {
    itemRepo.findOne.mockResolvedValue({
      id: 'item-1',
      title: 'Hari Permainan Tradisional',
      visibility: CalendarItemVisibility.PUBLIC,
      created_by: 'creator-1',
      creator: privateUser('creator-1'),
      invites: [],
    });

    const result = await calendarService.getOne('item-1');

    expect(result.creator).toEqual({
      id: 'creator-1',
      full_name: 'User creator-1',
      avatar_url: null,
      institution: 'KPOTI',
    });
    for (const key of PUBLIC_FORBIDDEN_KEYS) {
      expect(result.creator).not.toHaveProperty(key);
    }
    expect(result.title).toBe('Hari Permainan Tradisional');
  });

  it('getImportantDates strips private fields from the creator', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'item-1',
          type: CalendarItemType.IMPORTANT_DATE,
          creator: privateUser('creator-1'),
        },
      ]),
    };
    itemRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await calendarService.getImportantDates(
      { id: 'admin-1', role: UserRole.ADMIN_KPOTI } as User,
      {},
    );

    for (const key of PRIVATE_KEYS) {
      expect(result.data[0].creator).not.toHaveProperty(key);
    }
    expect(result.data[0].creator.email).toBe('creator-1@example.test');
  });

  it('getMyInvites strips private fields from the inviter and the item creator', async () => {
    inviteRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'invite-1',
          invitedByUser: privateUser('inviter-1'),
          calendarItem: { id: 'item-1', creator: privateUser('creator-1') },
        },
      ],
      1,
    ]);

    const result = await inviteService.getMyInvites('me', {});

    const [invite] = result.data;
    for (const key of PRIVATE_KEYS) {
      expect(invite.invitedByUser).not.toHaveProperty(key);
      expect(invite.calendarItem.creator).not.toHaveProperty(key);
    }
    expect(invite.invitedByUser.full_name).toBe('User inviter-1');
  });

  it('getInvitesForItem strips private fields from invitees', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'item-1', created_by: 'owner' });
    inviteRepo.findAndCount.mockResolvedValue([
      [{ id: 'invite-1', user: privateUser('invitee-1') }],
      1,
    ]);

    const result = await inviteService.getInvitesForItem(
      'item-1',
      { id: 'owner' } as User,
      {},
    );

    for (const key of PRIVATE_KEYS) {
      expect(result.data[0].user).not.toHaveProperty(key);
    }
    expect(result.data[0].user.email).toBe('invitee-1@example.test');
  });
});
