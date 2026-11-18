/**
 * @RequireVerifiedEmail() (Phase 09) on a TEST-ONLY route in a small Nest
 * app (no database): the guard, the decorator wiring and the 403 body with
 * code EMAIL_NOT_VERIFIED. A fake global guard plays the role of
 * JwtAuthGuard and sets req.user from a test header.
 */
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { RequireVerifiedEmail } from '../decorators/require-verified-email.decorator';
import { attachAuthState } from '../../modules/auth-core/email-verification';
import { User } from '../../modules/users/entities/user.entity';

const VERIFIED_ID = '00000000-0000-4000-8000-0000000000a1';
const UNVERIFIED_ID = '00000000-0000-4000-8000-0000000000a2';
const LEGACY_VERIFIED_ID = '00000000-0000-4000-8000-0000000000a3';

/** Stand-in for JwtAuthGuard: x-test-user selects the "authenticated" user. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const who = req.headers['x-test-user'];
    if (who === 'verified' || who === 'unverified') {
      // Local token: the strategy attached the state (no query).
      req.user = attachAuthState(
        { id: who === 'verified' ? VERIFIED_ID : UNVERIFIED_ID } as User,
        { emailVerified: who === 'verified', passwordChangedAt: null },
      );
    } else if (who === 'legacy') {
      // Legacy Supabase user: no attached state -> one query.
      req.user = { id: LEGACY_VERIFIED_ID };
    }
    return true;
  }
}

@Controller('test-only')
class TestOnlyController {
  @Get('points')
  @RequireVerifiedEmail()
  points() {
    return { ok: true };
  }

  @Get('open')
  open() {
    return { ok: true };
  }
}

describe('@RequireVerifiedEmail() (Phase 09)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  const dataSource = {
    query: jest.fn((_sql: string, [id]: string[]) =>
      Promise.resolve([{ verified: id === LEGACY_VERIFIED_ID }]),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestOnlyController],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => dataSource.query.mockClear());

  it('verified user (state from the local-jwt strategy): 200 without a query', async () => {
    await request(server())
      .get('/test-only/points')
      .set('x-test-user', 'verified')
      .expect(200, { ok: true });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('unverified user: 403 with code EMAIL_NOT_VERIFIED', async () => {
    const res = await request(server())
      .get('/test-only/points')
      .set('x-test-user', 'unverified')
      .expect(403);
    expect(res.body).toMatchObject({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email address to use this feature',
      path: '/test-only/points',
    });
  });

  it('user without attached state (legacy Supabase token): one query decides', async () => {
    await request(server())
      .get('/test-only/points')
      .set('x-test-user', 'legacy')
      .expect(200);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('no user: 401 (the global HttpExceptionFilter shape)', async () => {
    const res = await request(server()).get('/test-only/points').expect(401);
    expect(res.body).not.toHaveProperty('code');
  });

  it('routes without the decorator are unaffected', async () => {
    await request(server())
      .get('/test-only/open')
      .set('x-test-user', 'unverified')
      .expect(200);
  });
});
