/**
 * LocalAuthService (Phase 08): every branch of register, login, refresh,
 * logout, logout-all and the local change-password, with the database and
 * the Phase 07 services mocked. The real SQL (atomic counter, races) is
 * covered by test/integration/local-auth.int-spec.ts.
 */
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { RefreshConflictError, RefreshTokenInvalidError } from '../auth-errors';
import { UserCredential } from '../entities/user-credential.entity';
import {
  ACCOUNT_UNAVAILABLE_MESSAGE,
  CURRENT_PASSWORD_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  LocalAuthService,
  normalizeEmail,
} from '../local-auth.service';
import { fakeConfig } from './helpers';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'ani@example.test',
    full_name: 'Ani',
    role: UserRole.PUBLIK,
    status: UserStatus.ACTIVE,
    supabase_user_id: null,
    ...overrides,
  } as User;
}

function makeCredential(overrides: Partial<UserCredential> = {}) {
  return {
    user_id: USER_ID,
    password_hash: '$argon2id$old',
    password_algo: 'argon2id',
    failed_login_count: 0,
    locked_until: null,
    ...overrides,
  } as UserCredential;
}

function setup(env: Record<string, string | undefined> = {}) {
  const userRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const credRepo = {
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
  };
  const txUserRepo = {
    insert: jest.fn().mockResolvedValue({ identifiers: [{ id: USER_ID }] }),
  };
  const txCredRepo = {
    insert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const txManager = {
    getRepository: (entity: unknown) =>
      entity === User ? txUserRepo : txCredRepo,
  };
  const qb = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  const dataSource = {
    manager: {},
    getRepository: (entity: unknown) => (entity === User ? userRepo : credRepo),
    query: jest
      .fn()
      .mockResolvedValue([[{ failed_login_count: 1, locked_until: null }], 1]),
    createQueryBuilder: () => qb,
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
      cb(txManager),
    ),
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('$argon2id$new'),
    verify: jest.fn().mockResolvedValue({ ok: true, needsRehash: false }),
    verifyDummy: jest.fn().mockResolvedValue(false),
  };
  const tokens = {
    isEnabled: jest.fn().mockReturnValue(true),
    signAccessToken: jest
      .fn()
      .mockResolvedValue({ token: 'access-token', expiresIn: 900 }),
  };
  const issued = {
    token: 'raw-refresh',
    id: 'rt-1',
    userId: USER_ID,
    familyId: 'family-1',
    expiresAt: new Date(),
  };
  const refreshTokens = {
    issue: jest.fn().mockResolvedValue(issued),
    rotate: jest.fn().mockResolvedValue(issued),
    revokeFamily: jest.fn().mockResolvedValue(1),
    revokeAllForUser: jest.fn().mockResolvedValue(2),
    revokeAllForUserExcept: jest.fn().mockResolvedValue(1),
    findActive: jest.fn().mockResolvedValue(null),
  };
  const service = new LocalAuthService(
    dataSource as never,
    passwords as never,
    tokens as never,
    refreshTokens as never,
    fakeConfig(env),
  );
  const findUsers = jest
    .spyOn(service, 'findUsersByEmail')
    .mockResolvedValue([makeUser()]);
  const hooks = {
    registered: jest.spyOn(
      service as unknown as { onRegistered: () => void },
      'onRegistered',
    ),
    duplicate: jest.spyOn(
      service as unknown as { onDuplicateRegistration: () => void },
      'onDuplicateRegistration',
    ),
  };
  userRepo.findOneByOrFail.mockResolvedValue(makeUser());
  credRepo.findOneBy.mockResolvedValue(makeCredential());
  return {
    service,
    dataSource,
    userRepo,
    credRepo,
    txUserRepo,
    txCredRepo,
    qb,
    passwords,
    tokens,
    refreshTokens,
    issued,
    findUsers,
    hooks,
  };
}

const uniqueViolation = () =>
  new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error('dup'), { code: '23505' }),
  );

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Ani.Budi@Example.TEST ')).toBe(
      'ani.budi@example.test',
    );
  });
});

describe('LocalAuthService.register (Phase 08)', () => {
  const input = {
    email: ' New.User@Example.TEST ',
    password: 'correct horse battery',
    full_name: '  New User ',
  };

  it('rejects a password that fails the policy before hashing or looking up', async () => {
    const t = setup();
    await expect(
      t.service.register({ ...input, password: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      t.service.register({ ...input, password: 'new.user@example.test' }),
    ).rejects.toThrow('must not be the same as the email');
    expect(t.passwords.hash).not.toHaveBeenCalled();
    expect(t.findUsers).not.toHaveBeenCalled();
  });

  it('new email: users row (normalized, publik, active, no Supabase id) + Argon2id credential in ONE transaction', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    await t.service.register(input);
    expect(t.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(t.txUserRepo.insert).toHaveBeenCalledWith({
      email: 'new.user@example.test',
      full_name: 'New User',
      role: UserRole.PUBLIK,
      status: UserStatus.ACTIVE,
      supabase_user_id: null,
    });
    expect(t.txCredRepo.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      password_hash: '$argon2id$new',
      password_algo: 'argon2id',
    });
    expect(t.hooks.registered).toHaveBeenCalledWith(USER_ID);
    expect(t.hooks.duplicate).not.toHaveBeenCalled();
  });

  it('existing email (any user, Supabase-only included): changes NOTHING, still hashes (timing)', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([
      makeUser({ supabase_user_id: '22222222-2222-4222-8222-222222222222' }),
    ]);
    await expect(t.service.register(input)).resolves.toBeUndefined();
    expect(t.passwords.hash).toHaveBeenCalledTimes(1);
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
    expect(t.hooks.duplicate).toHaveBeenCalledTimes(1);
    expect(t.hooks.registered).not.toHaveBeenCalled();
  });

  it('several users match one email: refused silently (same result), nothing written', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([makeUser(), makeUser({ id: 'other' })]);
    await expect(t.service.register(input)).resolves.toBeUndefined();
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('lost race (unique violation): same result as an existing email', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    t.txUserRepo.insert.mockRejectedValue(uniqueViolation());
    await expect(t.service.register(input)).resolves.toBeUndefined();
    expect(t.hooks.duplicate).toHaveBeenCalledTimes(1);
    expect(t.hooks.registered).not.toHaveBeenCalled();
  });

  it('any other database error is rethrown', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    t.txCredRepo.insert.mockRejectedValue(new Error('db down'));
    await expect(t.service.register(input)).rejects.toThrow('db down');
  });
});

describe('LocalAuthService.login (Phase 08)', () => {
  const login = (t: ReturnType<typeof setup>, password = 'pw-correct') =>
    t.service.login('Ani@Example.test', password, { ip: '203.0.113.1' });

  async function expectGeneric401(promise: Promise<unknown>) {
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(promise).rejects.toThrow(LOGIN_FAILED_MESSAGE);
  }

  it('local auth disabled -> 503', async () => {
    const t = setup();
    t.tokens.isEnabled.mockReturnValue(false);
    await expect(login(t)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('unknown email -> dummy verification, generic 401', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([]);
    await expectGeneric401(login(t));
    expect(t.passwords.verifyDummy).toHaveBeenCalledTimes(1);
    expect(t.passwords.verify).not.toHaveBeenCalled();
  });

  it('several users match -> dummy verification, generic 401', async () => {
    const t = setup();
    t.findUsers.mockResolvedValue([makeUser(), makeUser({ id: 'x' })]);
    await expectGeneric401(login(t));
    expect(t.passwords.verifyDummy).toHaveBeenCalledTimes(1);
  });

  it('user without credentials (Supabase-only) -> dummy verification, generic 401', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(null);
    await expectGeneric401(login(t));
    expect(t.passwords.verifyDummy).toHaveBeenCalledTimes(1);
    expect(t.refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('locked account -> generic 401 WITHOUT verifying the password', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(
      makeCredential({ locked_until: new Date(Date.now() + 60_000) }),
    );
    await expectGeneric401(login(t));
    expect(t.passwords.verify).not.toHaveBeenCalled();
    expect(t.passwords.verifyDummy).not.toHaveBeenCalled();
    expect(t.dataSource.query).not.toHaveBeenCalled();
  });

  it('an expired lock no longer blocks', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(
      makeCredential({ locked_until: new Date(Date.now() - 1000) }),
    );
    await expect(login(t)).resolves.toMatchObject({
      accessToken: 'access-token',
    });
  });

  it('wrong password -> atomic increment with LOGIN_MAX_FAILED / LOGIN_LOCK_MINUTES, generic 401', async () => {
    const t = setup({ LOGIN_MAX_FAILED: '7', LOGIN_LOCK_MINUTES: '20' });
    t.passwords.verify.mockResolvedValue({ ok: false, needsRehash: false });
    await expectGeneric401(login(t));
    expect(t.dataSource.query).toHaveBeenCalledTimes(1);
    const [sql, params] = t.dataSource.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('failed_login_count = failed_login_count + 1');
    expect(sql).toContain('make_interval(mins => $3::int)');
    expect(params).toEqual([USER_ID, 7, 20]);
    expect(t.refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('correct password -> resets counter and lock, updates last_login_at, new family, access token, user', async () => {
    const t = setup();
    const session = await login(t);
    const [resetSql] = t.dataSource.query.mock.calls[0] as [string];
    expect(resetSql).toContain('failed_login_count = 0, locked_until = NULL');
    expect(t.userRepo.update).toHaveBeenCalledWith(
      { id: USER_ID },
      { last_login_at: expect.any(Date) as Date },
    );
    expect(t.refreshTokens.issue).toHaveBeenCalledWith(USER_ID, {
      ip: '203.0.113.1',
    });
    expect(t.tokens.signAccessToken).toHaveBeenCalledTimes(1);
    expect(session).toEqual({
      accessToken: 'access-token',
      expiresIn: 900,
      user: makeUser(),
      refreshToken: t.issued,
    });
    expect(t.qb.execute).not.toHaveBeenCalled(); // no rehash
  });

  it('needsRehash (legacy bcrypt) -> conditional update to a fresh Argon2id hash', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(
      makeCredential({ password_algo: 'bcrypt', password_hash: '$2a$old' }),
    );
    t.passwords.verify.mockResolvedValue({ ok: true, needsRehash: true });
    await login(t);
    expect(t.passwords.hash).toHaveBeenCalledWith('pw-correct');
    expect(t.qb.set).toHaveBeenCalledWith({
      password_hash: '$argon2id$new',
      password_algo: 'argon2id',
    });
    expect(t.qb.where).toHaveBeenCalledWith(
      'user_id = :userId AND password_hash = :oldHash',
      { userId: USER_ID, oldHash: '$2a$old' },
    );
  });

  it.each([UserStatus.SUSPENDED, UserStatus.INACTIVE])(
    '%s user with the correct password -> generic 403, no tokens',
    async (status) => {
      const t = setup();
      t.findUsers.mockResolvedValue([makeUser({ status })]);
      const attempt = login(t);
      await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
      await expect(attempt).rejects.toThrow(ACCOUNT_UNAVAILABLE_MESSAGE);
      expect(t.refreshTokens.issue).not.toHaveBeenCalled();
      expect(t.userRepo.update).not.toHaveBeenCalled();
    },
  );
});

describe('LocalAuthService.recordFailedAttempt (Phase 08)', () => {
  it('returns the new count and lock from RETURNING', async () => {
    const t = setup();
    const until = new Date();
    t.dataSource.query.mockResolvedValue([
      [{ failed_login_count: 5, locked_until: until }],
      1,
    ]);
    await expect(t.service.recordFailedAttempt(USER_ID)).resolves.toEqual({
      failedLoginCount: 5,
      lockedUntil: until,
    });
  });
});

describe('LocalAuthService.refresh (Phase 08)', () => {
  it('local auth disabled -> 503', async () => {
    const t = setup();
    t.tokens.isEnabled.mockReturnValue(false);
    await expect(t.service.refresh('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('no cookie -> 401 invalid_refresh_token', async () => {
    const t = setup();
    await expect(t.service.refresh(null)).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
    expect(t.refreshTokens.rotate).not.toHaveBeenCalled();
  });

  it('rotation errors (409 conflict, 401 reuse) propagate unchanged', async () => {
    const t = setup();
    t.refreshTokens.rotate.mockRejectedValueOnce(new RefreshConflictError());
    await expect(t.service.refresh('x')).rejects.toBeInstanceOf(
      RefreshConflictError,
    );
    t.refreshTokens.rotate.mockRejectedValueOnce(
      new RefreshTokenInvalidError('reuse_detected'),
    );
    await expect(t.service.refresh('x')).rejects.toBeInstanceOf(
      RefreshTokenInvalidError,
    );
  });

  it('success -> rotated token, last_login_at updated, new access token', async () => {
    const t = setup();
    t.userRepo.findOneBy.mockResolvedValue(makeUser());
    const session = await t.service.refresh('old', { userAgent: 'ua' });
    expect(t.refreshTokens.rotate).toHaveBeenCalledWith('old', {
      userAgent: 'ua',
    });
    expect(t.userRepo.update).toHaveBeenCalledWith(
      { id: USER_ID },
      { last_login_at: expect.any(Date) as Date },
    );
    expect(session.refreshToken).toBe(t.issued);
    expect(session.accessToken).toBe('access-token');
  });

  it.each([null, makeUser({ status: UserStatus.SUSPENDED })])(
    'user gone or not active (%p) -> family revoked, 401',
    async (user) => {
      const t = setup();
      t.userRepo.findOneBy.mockResolvedValue(user);
      await expect(t.service.refresh('old')).rejects.toBeInstanceOf(
        RefreshTokenInvalidError,
      );
      expect(t.refreshTokens.revokeFamily).toHaveBeenCalledWith(
        'family-1',
        'user_unavailable',
      );
      expect(t.tokens.signAccessToken).not.toHaveBeenCalled();
    },
  );
});

describe('LocalAuthService.logout / logoutAll (Phase 08)', () => {
  it('no cookie or an invalid one -> nothing revoked', async () => {
    const t = setup();
    await t.service.logout(null);
    await t.service.logout('unknown');
    expect(t.refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('a valid cookie -> its family is revoked', async () => {
    const t = setup();
    t.refreshTokens.findActive.mockResolvedValue({ family_id: 'family-9' });
    await t.service.logout('raw');
    expect(t.refreshTokens.revokeFamily).toHaveBeenCalledWith(
      'family-9',
      'logout',
    );
  });

  it('logoutAll revokes every token of the user', async () => {
    const t = setup();
    await expect(t.service.logoutAll(USER_ID)).resolves.toBe(2);
    expect(t.refreshTokens.revokeAllForUser).toHaveBeenCalledWith(
      USER_ID,
      'logout_all',
    );
  });
});

describe('LocalAuthService.changePassword (Phase 08)', () => {
  const user = makeUser();
  const change = (
    t: ReturnType<typeof setup>,
    current = 'old password 1',
    next = 'new password 22',
    cookie: string | null = null,
  ) => t.service.changePassword(user, current, next, cookie);

  it('no credentials -> 400', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(null);
    await expect(change(t)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locked -> 401 without verifying', async () => {
    const t = setup();
    t.credRepo.findOneBy.mockResolvedValue(
      makeCredential({ locked_until: new Date(Date.now() + 60_000) }),
    );
    await expect(change(t)).rejects.toThrow(CURRENT_PASSWORD_MESSAGE);
    expect(t.passwords.verify).not.toHaveBeenCalled();
  });

  it('wrong current password -> counts as a failed attempt, 401', async () => {
    const t = setup();
    t.passwords.verify.mockResolvedValue({ ok: false, needsRehash: false });
    await expect(change(t)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(t.dataSource.query).toHaveBeenCalledTimes(1);
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('same password or a policy failure -> 400, nothing stored', async () => {
    const t = setup();
    await expect(
      change(t, 'old password 1', 'old password 1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(change(t, 'old password 1', 'short')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      change(t, 'old password 1', 'ANI@example.test'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('success without cookie -> new Argon2id hash, password_changed_at, ALL refresh tokens revoked', async () => {
    const t = setup();
    await change(t);
    expect(t.txCredRepo.update).toHaveBeenCalledWith(
      { user_id: USER_ID },
      {
        password_hash: '$argon2id$new',
        password_algo: 'argon2id',
        password_changed_at: expect.any(Date) as Date,
        failed_login_count: 0,
        locked_until: null,
      },
    );
    expect(t.refreshTokens.revokeAllForUserExcept).toHaveBeenCalledWith(
      USER_ID,
      'password_changed',
      null,
      expect.anything(),
    );
  });

  it('success with the own refresh cookie -> that family is kept', async () => {
    const t = setup();
    t.refreshTokens.findActive.mockResolvedValue({
      user_id: USER_ID,
      family_id: 'mine',
    });
    await change(t, undefined, undefined, 'raw');
    expect(t.refreshTokens.revokeAllForUserExcept).toHaveBeenCalledWith(
      USER_ID,
      'password_changed',
      'mine',
      expect.anything(),
    );
  });

  it("another user's refresh cookie is ignored (everything revoked)", async () => {
    const t = setup();
    t.refreshTokens.findActive.mockResolvedValue({
      user_id: 'someone-else',
      family_id: 'theirs',
    });
    await change(t, undefined, undefined, 'raw');
    expect(t.refreshTokens.revokeAllForUserExcept).toHaveBeenCalledWith(
      USER_ID,
      'password_changed',
      null,
      expect.anything(),
    );
  });
});
