import { Logger } from '@nestjs/common';
import { createPublicKey } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify, SignJWT } from 'jose';
import { UserRole } from '../../users/entities/user.entity';
import {
  AccessTokenInvalidError,
  LocalAuthDisabledError,
} from '../auth-errors';
import { generateAuthKeyPair } from '../key-pair.util';
import { KeyService } from '../key.service';
import { JwksController } from '../jwks.controller';
import { authEnv, fakeConfig, testKeys, tokenServiceFor } from './helpers';

const USER = {
  id: '00000000-0000-4000-8000-0000000000a1',
  role: UserRole.PAKAR,
};

describe('TokenService (Phase 07)', () => {
  const { keyService, tokens } = tokenServiceFor(authEnv());

  it('signs RS256 tokens with kid header and the expected claims', async () => {
    const now = new Date('2026-11-18T10:00:00Z');
    const signed = await tokens.signAccessToken(USER, now);
    const header = decodeProtectedHeader(signed.token);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT', kid: testKeys().keyId });

    const { payload } = await jwtVerify(
      signed.token,
      createPublicKey(testKeys().publicKeyPem),
      { currentDate: now },
    );
    expect(payload).toMatchObject({
      sub: USER.id,
      role: UserRole.PAKAR,
      iss: 'unit-issuer',
      aud: 'unit-audience',
      iat: now.getTime() / 1000,
      exp: now.getTime() / 1000 + 900,
    });
    expect(typeof payload.jti).toBe('string');
    expect(signed.expiresIn).toBe(900);
    expect(signed.expiresAt.toISOString()).toBe('2026-11-18T10:15:00.000Z');
  });

  it('verifies its own token', async () => {
    const { token, jti } = await tokens.signAccessToken(USER);
    await expect(tokens.verifyAccessToken(token)).resolves.toMatchObject({
      sub: USER.id,
      role: UserRole.PAKAR,
      jti,
    });
  });

  it('uses a fresh jti for every token', async () => {
    const a = await tokens.signAccessToken(USER);
    const b = await tokens.signAccessToken(USER);
    expect(a.jti).not.toBe(b.jti);
  });

  const expectInvalid = (promise: Promise<unknown>) =>
    expect(promise).rejects.toBeInstanceOf(AccessTokenInvalidError);

  it('rejects a token signed with another key (same kid)', async () => {
    const other = generateAuthKeyPair('other');
    const { tokens: forger } = tokenServiceFor(
      authEnv({}, { ...other, keyId: testKeys().keyId }),
    );
    const { token } = await forger.signAccessToken(USER);
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects a wrong issuer', async () => {
    const { tokens: other } = tokenServiceFor(
      authEnv({ JWT_ISSUER: 'someone-else' }),
    );
    const { token } = await other.signAccessToken(USER);
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects a wrong audience', async () => {
    const { tokens: other } = tokenServiceFor(
      authEnv({ JWT_AUDIENCE: 'another-app' }),
    );
    const { token } = await other.signAccessToken(USER);
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects an expired token', async () => {
    const { token } = await tokens.signAccessToken(
      USER,
      new Date(Date.now() - 16 * 60 * 1000),
    );
    await expect(tokens.verifyAccessToken(token)).rejects.toThrow('expired');
  });

  it('rejects a tampered payload', async () => {
    const { token } = await tokens.signAccessToken(USER);
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as Record<string, unknown>;
    claims.role = UserRole.ADMIN_KPOTI;
    const forged = Buffer.from(JSON.stringify(claims)).toString('base64url');
    await expectInvalid(
      tokens.verifyAccessToken(`${header}.${forged}.${signature}`),
    );
  });

  it('rejects an unknown kid', async () => {
    const { tokens: other } = tokenServiceFor(
      authEnv({ JWT_KEY_ID: 'rotated-away' }),
    );
    const { token } = await other.signAccessToken(USER);
    await expect(tokens.verifyAccessToken(token)).rejects.toThrow(
      'unknown kid',
    );
  });

  it('rejects HS256 tokens and garbage', async () => {
    const hs = await new SignJWT({ role: 'admin_kpoti' })
      .setProtectedHeader({ alg: 'HS256', kid: testKeys().keyId })
      .setSubject(USER.id)
      .setIssuer('unit-issuer')
      .setAudience('unit-audience')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('x')
      .sign(new TextEncoder().encode('a-shared-secret-of-enough-length!!'));
    await expectInvalid(tokens.verifyAccessToken(hs));
    await expectInvalid(tokens.verifyAccessToken('not.a.jwt'));
  });

  it('rejects a token whose sub is not a uuid', async () => {
    const keys = keyService.getKeys();
    const token = await new SignJWT({ role: 'publik' })
      .setProtectedHeader({ alg: 'RS256', kid: keys.keyId })
      .setSubject('not-a-uuid')
      .setIssuer(keys.issuer)
      .setAudience(keys.audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('x')
      .sign(keys.privateKey);
    await expect(tokens.verifyAccessToken(token)).rejects.toThrow('bad sub');
  });
});

describe('KeyService JWKS (Phase 07)', () => {
  it('returns the public key as a JWKS with kid, alg and use', async () => {
    const keyService = new KeyService(fakeConfig(authEnv()));
    const jwks = await keyService.getJwks();
    expect(jwks.keys).toHaveLength(1);
    const [key] = jwks.keys;
    expect(Object.keys(key).sort()).toEqual(
      ['alg', 'e', 'kid', 'kty', 'n', 'use'].sort(),
    );
    expect(key).toMatchObject({
      kty: 'RSA',
      e: 'AQAB',
      kid: testKeys().keyId,
      alg: 'RS256',
      use: 'sig',
    });
    // Never any private component.
    for (const privateField of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(privateField);
    }
    // The JWK is the same key as the configured PEM.
    const fromJwk = createPublicKey({ key: key, format: 'jwk' });
    expect(fromJwk.export({ type: 'spki', format: 'pem' })).toBe(
      testKeys().publicKeyPem,
    );
  });
});

describe('Disabled mode (Phase 07)', () => {
  // Silence the expected startup warnings (one test below checks them).
  let silence: jest.SpyInstance;
  beforeEach(() => {
    silence = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => silence.mockRestore());

  const USER_ANY = { id: USER.id, role: UserRole.PUBLIK };

  it.each([
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'JWT_KEY_ID',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
  ])(
    'boots without %s and every key operation throws a clear error',
    async (missing) => {
      const { keyService, tokens } = tokenServiceFor(
        authEnv({ [missing]: undefined }),
      );
      expect(keyService.isEnabled()).toBe(false);
      expect(tokens.isEnabled()).toBe(false);
      expect(() => keyService.getKeys()).toThrow(LocalAuthDisabledError);
      expect(() => keyService.getKeys()).toThrow(missing);
      await expect(tokens.signAccessToken(USER_ANY)).rejects.toBeInstanceOf(
        LocalAuthDisabledError,
      );
      await expect(tokens.verifyAccessToken('x.y.z')).rejects.toBeInstanceOf(
        LocalAuthDisabledError,
      );
      await expect(keyService.getJwks()).rejects.toBeInstanceOf(
        LocalAuthDisabledError,
      );
    },
  );

  it('disables local auth for invalid or mismatched keys (never throws at startup)', () => {
    const other = generateAuthKeyPair('other');
    const mismatched = new KeyService(
      fakeConfig(authEnv({ JWT_PUBLIC_KEY: other.publicKeyBase64 })),
    );
    expect(mismatched.isEnabled()).toBe(false);
    expect(() => mismatched.getKeys()).toThrow('does not match');

    const garbage = new KeyService(
      fakeConfig(authEnv({ JWT_PRIVATE_KEY: 'bm90IGEga2V5' })),
    );
    expect(garbage.isEnabled()).toBe(false);
    expect(() => garbage.getKeys()).toThrow('not a valid PEM');
  });

  it('logs exactly one warning, naming variables but no key material', () => {
    const messages: string[] = [];
    const spy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        messages.push(String(message));
      });
    try {
      new KeyService(fakeConfig(authEnv({ JWT_KEY_ID: undefined })));
      new KeyService(fakeConfig(authEnv()));
    } finally {
      spy.mockRestore();
    }
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('DISABLED');
    expect(messages[0]).toContain('JWT_KEY_ID');
    expect(messages[0]).not.toContain(testKeys().privateKeyBase64.slice(0, 40));
  });

  it('JWKS endpoint returns 404 when disabled and the JWKS when enabled', async () => {
    const disabled = new JwksController(
      new KeyService(fakeConfig(authEnv({ JWT_ISSUER: undefined }))),
    );
    await expect(disabled.getJwks()).rejects.toMatchObject({ status: 404 });

    const enabled = new JwksController(new KeyService(fakeConfig(authEnv())));
    await expect(enabled.getJwks()).resolves.toMatchObject({
      keys: [{ kid: testKeys().keyId }],
    });
  });
});
