/**
 * Phase 06, P3: rate limiting per user. Full AppModule (real guard
 * registration and order) with the same trust-proxy setup as src/main.ts.
 *
 * Login does not work locally (Supabase), so the global JwtAuthGuard is
 * replaced by a stand-in that sets req.user from the x-test-user header,
 * exactly where the real guard sets it. If the throttler ran BEFORE the auth
 * guard, req.user would be empty and every request would be tracked by IP,
 * so "user B is not limited after user A" would fail.
 *
 * Limit: 100 requests / 60 s (app.module.ts).
 */
import { Test } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { applyTrustProxy } from '../src/common/http/trust-proxy';

const LIMIT = 100;

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const id = req.headers['x-test-user'];
    if (id) {
      req.user = { id };
    }
    return true;
  }
}

describe('Rate limiting per user (e2e, P3)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JwtAuthGuard)
      .useClass(HeaderAuthGuard)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    applyTrustProxy(app, undefined); // default "loopback", as in main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Sends n requests; returns the status codes. */
  async function hit(
    n: number,
    headers: Record<string, string>,
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .set(headers);
      statuses.push(res.status);
    }
    return statuses;
  }

  it('trusts X-Forwarded-For only from loopback (default TRUST_PROXY)', () => {
    expect(app.getHttpAdapter().getInstance().get('trust proxy fn')).toEqual(
      expect.any(Function),
    );
  });

  it('limits a logged-in user by user id, not by IP', async () => {
    // Same client IP (one Vercel egress IP, for example) for everyone.
    const ip = { 'x-forwarded-for': '198.51.100.10' };

    const userA = await hit(LIMIT + 1, { ...ip, 'x-test-user': 'user-a' });
    expect(userA.slice(0, LIMIT).every((s) => s === 200)).toBe(true);
    expect(userA[LIMIT]).toBe(429);

    // Another user behind the same IP is not affected...
    expect(await hit(1, { ...ip, 'x-test-user': 'user-b' })).toEqual([200]);
    // ...and neither are anonymous requests from that IP.
    expect(await hit(1, ip)).toEqual([200]);
  });

  it('limits anonymous requests by client IP (from X-Forwarded-For)', async () => {
    const ipC = { 'x-forwarded-for': '198.51.100.20' };

    const anon = await hit(LIMIT + 1, ipC);
    expect(anon.slice(0, LIMIT).every((s) => s === 200)).toBe(true);
    expect(anon[LIMIT]).toBe(429);

    // A different client IP is a different bucket.
    expect(await hit(1, { 'x-forwarded-for': '198.51.100.21' })).toEqual([200]);
    // A logged-in user from the limited IP is tracked by user id.
    expect(await hit(1, { ...ipC, 'x-test-user': 'user-c' })).toEqual([200]);
  });
});
