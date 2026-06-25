import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DaerahService } from '../daerah/daerah.service';
import { EmailService } from '../notifications';
import { SupabaseService } from '../supabase';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDaerahService = {
    findById: jest.fn(),
  };

  const mockSupabaseService = {
    createUser: jest.fn(),
  };

  const mockEmailService = {
    isCredentialEmailEnabled: jest.fn(),
    assertConfigured: jest.fn(),
    sendAdminCreatedUserCredentials: jest.fn(),
  };

  const baseUser: User = {
    id: 'user-1',
    supabase_user_id: 'supabase-user-1',
    email: 'user@example.com',
    full_name: 'Test User',
    role: UserRole.PUBLIK,
    status: UserStatus.ACTIVE,
    phone: null,
    avatar_url: null,
    bio: null,
    daerah_id: null,
    institution: null,
    expertise: null,
    last_login_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: DaerahService,
          useValue: mockDaerahService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateRole', () => {
    it('requires daerah_id when assigning kurator daerah role', async () => {
      mockUsersRepository.findOne.mockResolvedValue({ ...baseUser });

      await expect(
        service.updateRole('user-1', UserRole.KURATOR_DAERAH, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates and assigns daerah_id when assigning kurator daerah role', async () => {
      const user = { ...baseUser };
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockDaerahService.findById.mockResolvedValue({ id: 'daerah-1' });
      mockUsersRepository.save.mockImplementation(async (savedUser) => savedUser);

      const result = await service.updateRole(
        'user-1',
        UserRole.KURATOR_DAERAH,
        'admin-1',
        'daerah-1',
      );

      expect(mockDaerahService.findById).toHaveBeenCalledWith('daerah-1');
      expect(result.role).toBe(UserRole.KURATOR_DAERAH);
      expect(result.daerah_id).toBe('daerah-1');
      expect(result.updated_by).toBe('admin-1');
    });

    it('clears daerah_id when assigning a non-kurator role', async () => {
      const user = {
        ...baseUser,
        role: UserRole.KURATOR_DAERAH,
        daerah_id: 'daerah-1',
      };
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.save.mockImplementation(async (savedUser) => savedUser);

      const result = await service.updateRole(
        'user-1',
        UserRole.PAKAR,
        'admin-1',
      );

      expect(mockDaerahService.findById).not.toHaveBeenCalled();
      expect(result.role).toBe(UserRole.PAKAR);
      expect(result.daerah_id).toBeNull();
    });
  });

  describe('createByAdmin', () => {
    it('creates a Supabase user and local user without sending email by default', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockSupabaseService.createUser.mockResolvedValue({
        id: 'supabase-user-2',
        email: 'new@example.com',
      });
      const localUser = {
        ...baseUser,
        id: 'user-2',
        supabase_user_id: 'supabase-user-2',
        email: 'new@example.com',
        full_name: 'New User',
        role: UserRole.PAKAR,
        created_by: 'admin-1',
        updated_by: 'admin-1',
      };
      mockUsersRepository.create.mockReturnValue(localUser);
      mockUsersRepository.save.mockResolvedValue(localUser);

      const result = await service.createByAdmin(
        {
          email: 'new@example.com',
          password: 'Password123!',
          full_name: 'New User',
          role: UserRole.PAKAR,
        },
        'admin-1',
      );

      expect(mockSupabaseService.createUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Password123!',
        full_name: 'New User',
        email_confirm: true,
      });
      expect(mockEmailService.isCredentialEmailEnabled).not.toHaveBeenCalled();
      expect(mockEmailService.assertConfigured).not.toHaveBeenCalled();
      expect(
        mockEmailService.sendAdminCreatedUserCredentials,
      ).not.toHaveBeenCalled();
      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supabase_user_id: 'supabase-user-2',
          email: 'new@example.com',
          full_name: 'New User',
          role: UserRole.PAKAR,
          status: UserStatus.ACTIVE,
          created_by: 'admin-1',
          updated_by: 'admin-1',
        }),
      );
      expect(result).toBe(localUser);
    });

    it('requires daerah_id when creating kurator daerah user', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createByAdmin(
          {
            email: 'kurator@example.com',
            password: 'Password123!',
            full_name: 'Kurator User',
            role: UserRole.KURATOR_DAERAH,
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockSupabaseService.createUser).not.toHaveBeenCalled();
    });

    it('ignores send_email while credential email feature is disabled', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockEmailService.isCredentialEmailEnabled.mockReturnValue(false);
      mockSupabaseService.createUser.mockResolvedValue({
        id: 'supabase-user-4',
        email: 'disabled-email@example.com',
      });
      const localUser = {
        ...baseUser,
        id: 'user-4',
        supabase_user_id: 'supabase-user-4',
        email: 'disabled-email@example.com',
        full_name: 'Disabled Email User',
      };
      mockUsersRepository.create.mockReturnValue(localUser);
      mockUsersRepository.save.mockResolvedValue(localUser);

      await service.createByAdmin(
        {
          email: 'disabled-email@example.com',
          password: 'Password123!',
          full_name: 'Disabled Email User',
          send_email: true,
        },
        'admin-1',
      );

      expect(mockEmailService.isCredentialEmailEnabled).toHaveBeenCalled();
      expect(mockEmailService.assertConfigured).not.toHaveBeenCalled();
      expect(
        mockEmailService.sendAdminCreatedUserCredentials,
      ).not.toHaveBeenCalled();
    });

    it('sends credential email when requested', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockEmailService.isCredentialEmailEnabled.mockReturnValue(true);
      mockSupabaseService.createUser.mockResolvedValue({
        id: 'supabase-user-3',
        email: 'invite@example.com',
      });
      mockEmailService.sendAdminCreatedUserCredentials.mockResolvedValue(
        undefined,
      );
      const localUser = {
        ...baseUser,
        id: 'user-3',
        supabase_user_id: 'supabase-user-3',
        email: 'invite@example.com',
        full_name: 'Invite User',
      };
      mockUsersRepository.create.mockReturnValue(localUser);
      mockUsersRepository.save.mockResolvedValue(localUser);

      await service.createByAdmin(
        {
          email: 'invite@example.com',
          password: 'Password123!',
          full_name: 'Invite User',
          role: UserRole.PUBLIK,
          send_email: true,
        },
        'admin-1',
      );

      expect(mockEmailService.assertConfigured).toHaveBeenCalled();
      expect(
        mockEmailService.sendAdminCreatedUserCredentials,
      ).toHaveBeenCalledWith({
        to: 'invite@example.com',
        fullName: 'Invite User',
        email: 'invite@example.com',
        password: 'Password123!',
      });
    });
  });
});
