/**
 * Phase 06, P1: the users module never returns another user's
 * supabase_user_id; last_login_at only to admin_kpoti (user management).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserRole, UserStatus } from './entities/user.entity';

const target = {
  id: 'target-1',
  supabase_user_id: '00000000-0000-0000-0000-000000000006',
  email: 'target@example.test',
  full_name: 'Target',
  role: UserRole.PUBLIK,
  status: UserStatus.ACTIVE,
  last_login_at: new Date('2026-11-01T00:00:00Z'),
} as User;

const admin = { id: 'admin-1', role: UserRole.ADMIN_KPOTI } as User;
const kurator = { id: 'kurator-1', role: UserRole.KURATOR_DAERAH } as User;

describe('UsersController user views (P1)', () => {
  let controller: UsersController;
  const usersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createByAdmin: jest.fn(),
    updateRole: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();
    controller = module.get(UsersController);
  });

  const expectAdminView = (user: Partial<User>) => {
    expect(user).not.toHaveProperty('supabase_user_id');
    expect(user.last_login_at).toEqual(target.last_login_at);
    expect(user.email).toBe('target@example.test');
  };

  it('GET /users (admin) hides supabase_user_id and keeps last_login_at', async () => {
    usersService.findAll.mockResolvedValue({
      data: [target],
      pagination: { total: 1 },
    });

    const result = await controller.findAll(admin);

    expectAdminView(result.data[0]);
    expect(result.pagination).toEqual({ total: 1 });
  });

  it('GET /users/:id as admin hides supabase_user_id only', async () => {
    usersService.findById.mockResolvedValue(target);

    expectAdminView(await controller.findOne('target-1', admin));
  });

  it('GET /users/:id as kurator hides supabase_user_id and last_login_at', async () => {
    usersService.findById.mockResolvedValue(target);

    const result = await controller.findOne('target-1', kurator);

    expect(result).not.toHaveProperty('supabase_user_id');
    expect(result).not.toHaveProperty('last_login_at');
    expect(result.full_name).toBe('Target');
  });

  it('POST /users, PATCH role and status hide supabase_user_id', async () => {
    usersService.createByAdmin.mockResolvedValue(target);
    usersService.updateRole.mockResolvedValue(target);
    usersService.updateStatus.mockResolvedValue(target);

    expectAdminView(
      await controller.create(
        { email: 'x@example.test', password: 'x'.repeat(8), full_name: 'X' },
        admin,
      ),
    );
    expectAdminView(
      await controller.updateRole('target-1', { role: UserRole.PAKAR }, admin),
    );
    expectAdminView(
      await controller.updateStatus('target-1', UserStatus.ACTIVE, admin),
    );
  });

  it('GET /users/me still returns the caller in full', () => {
    expect(controller.getCurrentUser(target)).toBe(target);
  });
});
