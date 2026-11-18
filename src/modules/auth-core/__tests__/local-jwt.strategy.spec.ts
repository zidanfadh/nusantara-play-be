import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { generateAuthKeyPair } from '../key-pair.util';
import { extractBearerToken } from '../strategies/bearer-token.strategy';
import { LocalJwtStrategy } from '../strategies/local-jwt.strategy';
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

describe('LocalJwtStrategy (Phase 07)', () => {
  const { tokens } = tokenServiceFor(authEnv());

  function strategyWith(found: User | null) {
    const repo = {
      findOneBy: jest.fn().mockResolvedValue(found),
      save: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const strategy = new LocalJwtStrategy(
      tokens,
      repo as unknown as Repository<User>,
    );
    return { strategy, repo };
  }

  it('accepts a valid token of an active user and returns the User entity', async () => {
    const active = user(UserStatus.ACTIVE);
    const { strategy, repo } = strategyWith(active);
    const { token } = await tokens.signAccessToken(active);
    await expect(strategy.validate(token)).resolves.toBe(active);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: ID });
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

  it('rejects a forged token without touching the database', async () => {
    const { strategy, repo } = strategyWith(user(UserStatus.ACTIVE));
    const { tokens: forger } = tokenServiceFor(
      authEnv({}, generateAuthKeyPair('forger')),
    );
    const { token } = await forger.signAccessToken(user(UserStatus.ACTIVE));
    await expect(strategy.validate(token)).resolves.toBeNull();
    expect(repo.findOneBy).not.toHaveBeenCalled();
  });

  it('fails (does not throw) for every token while local auth is disabled', async () => {
    const { token } = await tokens.signAccessToken(user(UserStatus.ACTIVE));
    const { tokens: disabled } = tokenServiceFor(
      authEnv({ JWT_PRIVATE_KEY: undefined }),
    );
    const repo = { findOneBy: jest.fn() };
    const strategy = new LocalJwtStrategy(
      disabled,
      repo as unknown as Repository<User>,
    );
    await expect(strategy.validate(token)).resolves.toBeNull();
    expect(repo.findOneBy).not.toHaveBeenCalled();
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
