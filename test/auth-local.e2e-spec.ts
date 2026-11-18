/**
 * Self-hosted auth foundation (Phase 07), full AppModule on the local test
 * database. test/test-env.ts provides a fresh RS256 key pair per test
 * process (never on disk).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { createPublicKey } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { TokenService } from '../src/modules/auth-core/token.service';
import { KeyService } from '../src/modules/auth-core/key.service';
import { generateAuthKeyPair } from '../src/modules/auth-core/key-pair.util';
import {
  User,
  UserRole,
  UserStatus,
} from '../src/modules/users/entities/user.entity';
import { DEMO_IDS, DEMO_USER_EMAIL } from '../src/scripts/db-local-setup';
import { TEST_JWT_AUDIENCE, TEST_JWT_ISSUER } from './test-env';

async function createApp(): Promise<{
  app: INestApplication<App>;
  moduleFixture: TestingModule;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  await app.init();
  return { app, moduleFixture };
}

describe('Self-hosted auth foundation (e2e, Phase 07)', () => {
  let app: INestApplication<App>;
  let tokens: TokenService;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
    tokens = created.moduleFixture.get(TokenService);
    dataSource = created.moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await dataSource.query(`DELETE FROM users WHERE id = ANY($1)`, [
        createdUserIds,
      ]);
    }
    await app.close();
  });

  const demoUser = () =>
    dataSource.getRepository(User).findOneByOrFail({ id: DEMO_IDS.user });

  it('GET /api/users/me with a TokenService access token for the DEMO user -> 200', async () => {
    const user = await demoUser();
    const before = user.last_login_at;
    const { token } = await tokens.signAccessToken(user);

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      id: DEMO_IDS.user,
      email: DEMO_USER_EMAIL,
      role: UserRole.KURATOR_DAERAH,
    });

    // The new strategy never writes on a request (no last_login_at update).
    const after = await demoUser();
    expect(after.last_login_at).toEqual(before);
  });

  it('@Roles still works with our tokens (kurator on an admin-only route -> 403)', async () => {
    const { token } = await tokens.signAccessToken(await demoUser());
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('a forged token (other key, same kid/iss/aud) -> 401', async () => {
    const forgerKeys = generateAuthKeyPair('forger');
    const forger = new TokenService(
      new KeyService({
        get: (key: string) =>
          ({
            JWT_PRIVATE_KEY: forgerKeys.privateKeyBase64,
            JWT_PUBLIC_KEY: forgerKeys.publicKeyBase64,
            JWT_KEY_ID: process.env.JWT_KEY_ID,
            JWT_ISSUER: TEST_JWT_ISSUER,
            JWT_AUDIENCE: TEST_JWT_AUDIENCE,
          })[key],
      } as never),
    );
    const { token } = await forger.signAccessToken(await demoUser());
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('no token -> 401; a suspended user with a valid token -> 401', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);

    const suffix = randomUUID().slice(0, 8);
    const suspended = await dataSource.getRepository(User).save({
      supabase_user_id: null,
      email: `e2e-suspended-${suffix}@example.test`,
      full_name: `E2E Suspended ${suffix}`,
      status: UserStatus.SUSPENDED,
    });
    createdUserIds.push(suspended.id);
    const { token } = await tokens.signAccessToken(suspended);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('GET /api/auth/jwks.json returns the public key', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/jwks.json')
      .expect(200);
    expect(res.body.keys).toHaveLength(1);
    const [jwk] = res.body.keys as Record<string, string>[];
    expect(jwk).toMatchObject({
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
      kid: process.env.JWT_KEY_ID,
    });
    expect(jwk).not.toHaveProperty('d');
    // It is the configured public key.
    const expected = Buffer.from(
      process.env.JWT_PUBLIC_KEY as string,
      'base64',
    ).toString('utf8');
    expect(
      createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem',
      }),
    ).toBe(expected);
  });

  it('public endpoints still work with and without a token', async () => {
    const { token } = await tokens.signAccessToken(await demoUser());
    await request(app.getHttpServer()).get('/api/auth/health').expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/health')
      .set('Authorization', 'Bearer garbage')
      .expect(200);
  });
});

describe('Without auth keys the app still boots (e2e, Phase 07)', () => {
  const NAMES = [
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'JWT_KEY_ID',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
  ];
  const saved: Record<string, string | undefined> = {};
  let app: INestApplication<App>;
  let tokens: TokenService;

  beforeAll(async () => {
    // Empty (not deleted), so .env.local can never fill them in.
    for (const name of NAMES) {
      saved[name] = process.env[name];
      process.env[name] = '';
    }
    const created = await createApp();
    app = created.app;
    tokens = created.moduleFixture.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
    for (const name of NAMES) {
      process.env[name] = saved[name];
    }
  });

  it('local auth is disabled, JWKS is 404, public routes work, protected routes 401', async () => {
    expect(tokens.isEnabled()).toBe(false);
    await request(app.getHttpServer()).get('/api/auth/jwks.json').expect(404);
    await request(app.getHttpServer()).get('/api/auth/health').expect(200);
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });
});
