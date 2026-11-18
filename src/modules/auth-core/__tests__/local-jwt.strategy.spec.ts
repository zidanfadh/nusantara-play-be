import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { generateAuthKeyPair } from '../key-pair.util';
import { extractBearerToken } from '../strategies/bearer-token.strategy';
import { getAuthState } from '../email-verification';
import {
  LocalJwtStrategy,
  PASSWORD_CHANGE_SKEW_MS,
} from '../strategies/local-jwt.strategy';
import { authEnv, tokenServiceFor } from './helpers';

const ID = '00000000-0000-4000-8000-0000000000b1';

function user(status: UserStatus): User {
  return {
    id: ID,
    email: 'unit@example.test',
    role: UserRole.KURATOR_DAERAH,
    status,
  } as User;
}

describe('LocalJwtStrategy (Phase 07, password change check since Phase 09)', () => {
  const { tokens } = tokenServiceFor(authEnv());

  /** Repository whose query builder returns one users row + auth columns. */
  function strategyWith(
    found: User | null,
    authRow: {
      auth_password_changed_at?: Date | null;
      auth_email_verified?: boolean;
    } = {},
  ) {
    const qb = {
      leftJoin: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: found ? [found] : [],
        raw: found
          ? [
              {
                auth_password_changed_at: null,
                auth_email_verified: false,
                ...authRow,
              },
            ]
          : [],
      }),
    };
    qb.leftJoin.mockReturnValue(qb);
    qb.addSelect.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      save: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const strategy = new LocalJwtStrategy(
      tokens,
      repo as unknown as Repository<User>,
    );
    return { strategy, repo, qb };
  }

  it('accepts a valid token of an active user with ONE read-only query and attaches the auth state', async () => {
    const active = user(UserStatus.ACTIVE);
    const { strategy, repo, qb } = strategyWith(active, {
      auth_email_verified: true,
    });
    const { token } = await tokens.signAccessToken(active);
    const result = await strategy.validate(token);
    expect(result).toBe(active);
    expect(getAuthState(result)).toEqual({
      emailVerified: true,
      passwordChangedAt: null,
    });
    // The state is a symbol: never part of a JSON response.
    expect(JSON.stringify(result)).not.toContain('emailVerified');
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.getRawAndEntities).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith('u.id = :userId', { userId: ID });
    // Read-only: never writes to the database.
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it.each([UserStatus.SUSPENDED, UserStatus.INACTIVE])(
    'rejects a %s user',
    async (status) => {
      const { strategy } = strategyWith(user(status));
      const { token } = await tokens.signAccessToken(user(status));
      await expect(strategy.validate(token)).resolves.toBeNull();
    },
  );

  it('rejects an unknown user', async () => {
    const { strategy } = strategyWith(null);
    const { token } = await tokens.signAccessToken(user(UserStatus.ACTIVE));
    await expect(strategy.validate(token)).resolves.toBeNull();
  });

  it('rejects a token issued before the last password change (beyond the skew)', async () => {
    const changedAt = new Date();
    const { strategy } = strategyWith(user(UserStatus.ACTIVE), {
      auth_password_changed_at: changedAt,
    });
    const { token } = await tokens.signAccessToken(
      user(UserStatus.ACTIVE),
      new Date(changedAt.getTime() - PASSWORD_CHANGE_SKEW_MS - 2_000),
    );
    await expect(strategy.validate(token)).resolves.toBeNull();
  });

  it('accepts a token issued within the skew before the change, and any token after it', async () => {
    const changedAt = new Date();
    const active = user(UserStatus.ACTIVE);
    const { strategy } = strategyWith(active, {
      auth_password_changed_at: changedAt,
    });
    const justBefore = await tokens.signAccessToken(
      active,
      new Date(changedAt.getTime() - PASSWORD_CHANGE_SKEW_MS + 1_500),
    );
    await expect(strategy.validate(justBefore.token)).resolves.toBe(active);
    const after = await tokens.signAccessToken(
      active,
      new Date(changedAt.getTime() + 1_000),
    );
    await expect(strategy.validate(after.token)).resolves.toBe(active);
  });

  it('accepts old tokens when the password was never changed (or the user has no password)', async () => {
    const active = user(UserStatus.ACTIVE);
    const { strategy } = strategyWith(active);
    const { token } = await tokens.signAccessToken(
      active,
      new Date(Date.now() - 10 * 60_000),
    );
    await expect(strategy.validate(token)).resolves.toBe(active);
  });

  it('rejects a forged token without touching the database', async () => {
    const { strategy, repo } = strategyWith(user(UserStatus.ACTIVE));
    const { tokens: forger } = tokenServiceFor(
      authEnv({}, generateAuthKeyPair('forger')),
    );
    const { token } = await forger.signAccessToken(user(UserStatus.ACTIVE));
    await expect(strategy.validate(token)).resolves.toBeNull();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('fails (does not throw) for every token while local auth is disabled', async () => {
    const { token } = await tokens.signAccessToken(user(UserStatus.ACTIVE));
    const { tokens: disabled } = tokenServiceFor(
      authEnv({ JWT_PRIVATE_KEY: undefined }),
    );
    const repo = { createQueryBuilder: jest.fn() };
    const strategy = new LocalJwtStrategy(
      disabled,
      repo as unknown as Repository<User>,
    );
    await expect(strategy.validate(token)).resolves.toBeNull();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('extractBearerToken', () => {
  it('reads Authorization: Bearer <token>', () => {
    expect(
      extractBearerToken({ headers: { authorization: 'Bearer abc.def.ghi' } }),
    ).toBe('abc.def.ghi');
    expect(
      extractBearerToken({ headers: { authorization: 'bearer abc' } }),
    ).toBe('abc');
  });

  it('returns null for anything else', () => {
    expect(extractBearerToken({ headers: {} })).toBeNull();
    expect(
      extractBearerToken({ headers: { authorization: 'Basic abc' } }),
    ).toBeNull();
    expect(
      extractBearerToken({ headers: { authorization: 'Bearer a b' } }),
    ).toBeNull();
  });
});
