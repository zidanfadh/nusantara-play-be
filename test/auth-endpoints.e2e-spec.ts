/**
 * Self-hosted auth endpoints (Phase 08), full AppModule on the local test
 * database, set up like src/main.ts (test/e2e-app.ts). Test env:
 * AUTH_COOKIE_PATH=/api/auth, FRONTEND_URLS=http://localhost:3001,
 * FRONTEND_ORIGIN_PATTERNS=TEST_ORIGIN_PATTERN, REFRESH_REUSE_GRACE_SECONDS=20,
 * LOGIN_MAX_FAILED=5 (test/test-env.ts).
 *
 * Every test uses its own client IP (X-Forwarded-For, trusted from
 * loopback) so the per-IP limits (30 logins / minute) never interfere.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { hashRefreshToken } from '../src/modules/auth-core/refresh-token.service';
import { TokenService } from '../src/modules/auth-core/token.service';
import { LocalJwtStrategy } from '../src/modules/auth-core/strategies/local-jwt.strategy';
import {
  LOGIN_FAILED_MESSAGE,
  REGISTER_RESPONSE,
} from '../src/modules/auth-core/local-auth.service';
import { User, UserStatus } from '../src/modules/users/entities/user.entity';
import { createE2eApp, isCleared, parseSetCookies, SetCookie } from './e2e-app';

const ORIGIN = 'http://localhost:3001';
const CSRF = { 'X-Requested-With': 'nusantara-play', Origin: ORIGIN };
const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another long passphrase';
const TTL_SECONDS = 30 * 24 * 60 * 60;

let ipSeq = 0;
const freshIp = () => `198.51.100.${(ipSeq += 1)}`;

function cookieOf(res: request.Response, name: string): SetCookie | undefined {
  return parseSetCookies(res.headers['set-cookie']).find(
    (c) => c.name === name,
  );
}

interface SessionUser {
  id: string;
  last_login_at: string | null;
  [key: string]: unknown;
}
interface SessionBody {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}
interface ErrorBody {
  statusCode: number;
  message: string;
  error?: string;
  timestamp?: string;
  [key: string]: unknown;
}
const sessionBody = (res: request.Response) => res.body as SessionBody;
const sessionUser = (res: request.Response) => res.body as SessionUser;
const errorBody = (res: request.Response) => res.body as ErrorBody;

/** A Set-Cookie that must be present. */
function mustCookie(res: request.Response, name: string): SetCookie {
  const cookie = cookieOf(res, name);
  if (!cookie) {
    throw new Error(`no Set-Cookie for ${name}`);
  }
  return cookie;
}

describe('Self-hosted auth endpoints (e2e, Phase 08)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let tokens: TokenService;
  let strategy: LocalJwtStrategy;
  const emails: string[] = [];

  beforeAll(async () => {
    const created = await createE2eApp();
    app = created.app;
    dataSource = created.moduleRef.get(DataSource);
    tokens = created.moduleRef.get(TokenService);
    strategy = created.moduleRef.get(LocalJwtStrategy);
  });

  afterAll(async () => {
    if (emails.length) {
      const lower = emails.map((e) => e.toLowerCase());
      await dataSource.query(
        `DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = ANY($1))`,
        [lower],
      );
      await dataSource.query(`DELETE FROM users WHERE LOWER(email) = ANY($1)`, [
        lower,
      ]);
    }
    await app.close();
  });

  const newEmail = (label: string) => {
    const email = `e2e-auth-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(email);
    return email;
  };

  /** HTTP helpers bound to one client IP. */
  function client(ip = freshIp()) {
    const server = app.getHttpServer();
    const post = (path: string) =>
      request(server).post(`/api/auth/${path}`).set('X-Forwarded-For', ip);
    return {
      register: (email: string, password = PASSWORD) =>
        post('register').send({ email, password, full_name: 'E2E User' }),
      login: (email: string, password = PASSWORD) =>
        post('login').send({ email, password }),
      refresh: (cookie?: string, headers: Record<string, string> = CSRF) => {
        const req = post('refresh').set(headers);
        return cookie ? req.set('Cookie', `np_refresh=${cookie}`) : req;
      },
      logout: (cookie?: string, headers: Record<string, string> = CSRF) => {
        const req = post('logout').set(headers);
        return cookie ? req.set('Cookie', `np_refresh=${cookie}`) : req;
      },
      logoutAll: (
        accessToken?: string,
        headers: Record<string, string> = CSRF,
      ) => {
        const req = post('logout-all').set(headers);
        return accessToken
          ? req.set('Authorization', `Bearer ${accessToken}`)
          : req;
      },
      changePassword: (
        accessToken: string,
        body: object,
        cookie?: string,
        headers: Record<string, string> = {},
      ) => {
        const req = post('change-password')
          .set('Authorization', `Bearer ${accessToken}`)
          .set(headers)
          .send(body);
        return cookie ? req.set('Cookie', `np_refresh=${cookie}`) : req;
      },
      me: (accessToken: string) =>
        request(server)
          .get('/api/users/me')
          .set('X-Forwarded-For', ip)
          .set('Authorization', `Bearer ${accessToken}`),
    };
  }

  /** Registers + logs in; returns the session. */
  async function session(label: string, c = client()) {
    const email = newEmail(label);
    await c.register(email).expect(201);
    const res = await c.login(email).expect(200);
    return {
      email,
      accessToken: sessionBody(res).accessToken,
      user: sessionBody(res).user,
      refresh: mustCookie(res, 'np_refresh').value,
    };
  }

  it('full flow: register -> login -> /users/me -> refresh (409 in grace, 401 after) -> change-password -> logout -> logout-all', async () => {
    const c = client();
    const email = newEmail('flow');

    // register: 201, generic body, no tokens, no cookies
    const reg = await c.register(` ${email.toUpperCase()} `).expect(201);
    expect(reg.body).toEqual(REGISTER_RESPONSE);
    expect(reg.headers['set-cookie']).toBeUndefined();

    // login (any case / spaces)
    const login = await c.login(`  ${email.toUpperCase()}`).expect(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(Object.keys(sessionBody(login)).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'user',
    ]);
    expect(sessionBody(login).expiresIn).toBe(900);
    expect(sessionBody(login).user).toMatchObject({
      email,
      role: 'publik',
      status: 'active',
      supabase_user_id: null,
    });
    expect(sessionBody(login).user.last_login_at).not.toBeNull();
    const refresh1 = mustCookie(login, 'np_refresh');
    const marker = mustCookie(login, 'np_logged_in');

    // cookie attributes (test env: not Secure, Path=/api/auth)
    expect(refresh1.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(refresh1.attributes).toMatchObject({
      httponly: '',
      samesite: 'Lax',
      path: '/api/auth',
      'max-age': String(TTL_SECONDS),
    });
    expect(refresh1.attributes).not.toHaveProperty('domain');
    expect(refresh1.attributes).not.toHaveProperty('secure');
    expect(marker.value).toBe('1');
    expect(marker.attributes).toMatchObject({
      samesite: 'Lax',
      path: '/',
      'max-age': String(TTL_SECONDS),
    });
    expect(marker.attributes).not.toHaveProperty('httponly');
    expect(marker.attributes).not.toHaveProperty('domain');
    // The refresh token is ONLY in the cookie.
    expect(JSON.stringify(sessionBody(login))).not.toContain(refresh1.value);

    // GET /api/users/me with the access token: same user shape as login
    const me = await c.me(sessionBody(login).accessToken).expect(200);
    expect(Object.keys(sessionUser(me)).sort()).toEqual(
      Object.keys(sessionBody(login).user).sort(),
    );
    expect(sessionUser(me).id).toBe(sessionBody(login).user.id);

    // refresh: cookie rotates
    const r2 = await c.refresh(refresh1.value).expect(200);
    const refresh2 = mustCookie(r2, 'np_refresh');
    expect(refresh2.value).not.toBe(refresh1.value);
    expect(sessionBody(r2).user.id).toBe(sessionBody(login).user.id);
    await c.me(sessionBody(r2).accessToken).expect(200);

    // old cookie inside the grace window: 409, cookies NOT cleared
    const conflict = await c.refresh(refresh1.value).expect(409);
    expect(errorBody(conflict).error).toBe('refresh_conflict');
    expect(conflict.headers['set-cookie']).toBeUndefined();

    // ...and after it: 401, both cookies cleared, family revoked
    await dataSource.query(
      `UPDATE refresh_tokens SET revoked_at = now() - interval '60 seconds' WHERE token_hash = $1`,
      [hashRefreshToken(refresh1.value)],
    );
    const reuse = await c.refresh(refresh1.value).expect(401);
    expect(errorBody(reuse).error).toBe('invalid_refresh_token');
    expect(isCleared(cookieOf(reuse, 'np_refresh'))).toBe(true);
    expect(mustCookie(reuse, 'np_refresh').attributes.path).toBe('/api/auth');
    expect(isCleared(cookieOf(reuse, 'np_logged_in'))).toBe(true);
    expect(mustCookie(reuse, 'np_logged_in').attributes.path).toBe('/');
    await c.refresh(refresh2.value).expect(401); // whole family revoked

    // change-password (access token still valid)
    await c
      .changePassword(sessionBody(r2).accessToken, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      })
      .expect(204);
    await c.login(email, PASSWORD).expect(401);
    const relogin = await c.login(email, NEW_PASSWORD).expect(200);
    const refresh3 = mustCookie(relogin, 'np_refresh').value;

    // logout: 204, cookies cleared, the token is dead
    const out = await c.logout(refresh3).expect(204);
    expect(isCleared(cookieOf(out, 'np_refresh'))).toBe(true);
    expect(isCleared(cookieOf(out, 'np_logged_in'))).toBe(true);
    await c.refresh(refresh3).expect(401);

    // logout-all: two sessions, both die
    const a = await c.login(email, NEW_PASSWORD).expect(200);
    const b = await c.login(email, NEW_PASSWORD).expect(200);
    const all = await c.logoutAll(sessionBody(a).accessToken).expect(204);
    expect(isCleared(cookieOf(all, 'np_refresh'))).toBe(true);
    await c.refresh(mustCookie(a, 'np_refresh').value).expect(401);
    await c.refresh(mustCookie(b, 'np_refresh').value).expect(401);
  });

  it('refresh and logout without a cookie: 401 / 204, cookies cleared', async () => {
    const c = client();
    const r = await c.refresh().expect(401);
    expect(isCleared(cookieOf(r, 'np_refresh'))).toBe(true);
    const out = await c.logout().expect(204);
    expect(isCleared(cookieOf(out, 'np_logged_in'))).toBe(true);
  });

  it('CSRF: missing X-Requested-With, wrong or missing Origin -> 403; a FRONTEND_ORIGIN_PATTERNS origin works', async () => {
    const c = client();
    const s = await session('csrf', c);

    await c.refresh(s.refresh, { Origin: ORIGIN }).expect(403);
    await c
      .refresh(s.refresh, {
        'X-Requested-With': 'XMLHttpRequest',
        Origin: ORIGIN,
      })
      .expect(403);
    await c
      .refresh(s.refresh, {
        'X-Requested-With': 'nusantara-play',
        Origin: 'https://evil.example',
      })
      .expect(403);
    await c
      .refresh(s.refresh, { 'X-Requested-With': 'nusantara-play' })
      .expect(403);
    await c
      .refresh(s.refresh, {
        'X-Requested-With': 'nusantara-play',
        Origin: 'https://nusantara-play-fe-git-pr-42.vercel.app.evil.example',
      })
      .expect(403);
    await c.logout(s.refresh, { Origin: ORIGIN }).expect(403);
    await c
      .logoutAll(s.accessToken, { Origin: 'https://evil.example' })
      .expect(403);

    // The token survived all of that (403 happens before anything else).
    const ok = await c
      .refresh(s.refresh, {
        'X-Requested-With': 'nusantara-play',
        Origin: 'https://nusantara-play-fe-git-pr-42.vercel.app',
      })
      .expect(200);
    expect(cookieOf(ok, 'np_refresh')).toBeDefined();
  });

  it('logout-all needs a valid access token', async () => {
    await client().logoutAll().expect(401);
  });

  it('lockout: 5 wrong passwords lock the account; then even the correct password fails (same generic 401)', async () => {
    const c = client();
    const email = newEmail('lockout');
    await c.register(email).expect(201);
    for (let i = 0; i < 5; i += 1) {
      const res = await c.login(email, 'wrong password!!').expect(401);
      expect(errorBody(res).message).toBe(LOGIN_FAILED_MESSAGE);
    }
    const locked = await c.login(email).expect(401);
    expect(errorBody(locked).message).toBe(LOGIN_FAILED_MESSAGE);
    const [row] = await dataSource.query<
      { failed_login_count: number; locked: boolean }[]
    >(
      `SELECT c.failed_login_count, c.locked_until > now() AS locked
         FROM user_credentials c JOIN users u ON u.id = c.user_id
        WHERE u.email = $1`,
      [email],
    );
    expect(row).toEqual({ failed_login_count: 5, locked: true });
  });

  it('a suspended user cannot log in (generic 403, no cookies)', async () => {
    const c = client();
    const email = newEmail('suspended');
    await c.register(email).expect(201);
    await dataSource.query(`UPDATE users SET status = $1 WHERE email = $2`, [
      UserStatus.SUSPENDED,
      email,
    ]);
    const res = await c.login(email).expect(403);
    expect(errorBody(res).message).toBe('This account cannot sign in');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('a suspended user loses the session on refresh', async () => {
    const c = client();
    const s = await session('suspended-refresh', c);
    await dataSource.query(`UPDATE users SET status = $1 WHERE id = $2`, [
      UserStatus.SUSPENDED,
      s.user.id,
    ]);
    const res = await c.refresh(s.refresh).expect(401);
    expect(isCleared(cookieOf(res, 'np_refresh'))).toBe(true);
  });

  it('generic errors never reveal whether an email exists', async () => {
    const c = client();
    const existing = await session('exists', c);
    const unknown = newEmail('unknown');
    const supabaseOnly = newEmail('supabase-only');
    await dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email: supabaseOnly,
      full_name: 'Supabase Only',
    });

    // login: unknown email, wrong password, Supabase-only -> identical
    const bodies = await Promise.all([
      c.login(unknown).expect(401),
      c.login(existing.email, 'wrong password!!').expect(401),
      c.login(supabaseOnly).expect(401),
    ]);
    const strip = (b: ErrorBody) => {
      const { timestamp: _t, ...rest } = b;
      void _t;
      return rest;
    };
    expect(strip(errorBody(bodies[1]))).toEqual(strip(errorBody(bodies[0])));
    expect(strip(errorBody(bodies[2]))).toEqual(strip(errorBody(bodies[0])));

    // register: new, existing (with password) and Supabase-only -> identical
    const regs = await Promise.all([
      c.register(newEmail('fresh')),
      c.register(existing.email.toUpperCase(), 'some other password'),
      c.register(supabaseOnly, 'attacker password'),
    ]);
    for (const res of regs) {
      expect(res.status).toBe(201);
      expect(res.body).toEqual(REGISTER_RESPONSE);
    }
    // The Supabase-only account got no password attached.
    const creds = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM user_credentials c JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
      [supabaseOnly],
    );
    expect(creds[0].n).toBe(0);
    // ...and the existing account still has its own password.
    await c.login(existing.email).expect(200);
  });

  it('register race over HTTP: 2 parallel registrations -> exactly one user, identical responses', async () => {
    const c = client();
    const email = newEmail('race');
    const [a, b] = await Promise.all([c.register(email), c.register(email)]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body).toEqual(b.body);
    const rows = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM users WHERE LOWER(email) = $1`,
      [email],
    );
    expect(rows[0].n).toBe(1);
  });

  it('register validates input (policy, unknown fields)', async () => {
    const c = client();
    const email = newEmail('invalid');
    await c.register(email, 'short').expect(400);
    await c.register(email, email.toUpperCase()).expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Forwarded-For', freshIp())
      .send({ email, password: PASSWORD, full_name: 'X', role: 'admin_kpoti' })
      .expect(400);
    const rows = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM users WHERE email = $1`,
      [email],
    );
    expect(rows[0].n).toBe(0);
  });

  it('change-password with the own cookie keeps this session and revokes the others; passwords are redacted in audit_logs', async () => {
    const c = client();
    const s = await session('change', c);
    const other = await c.login(s.email).expect(200);
    const otherCookie = mustCookie(other, 'np_refresh').value;

    // With the cookie the CSRF check applies.
    await c
      .changePassword(
        s.accessToken,
        { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
        s.refresh,
      )
      .expect(403);

    // Wrong current password: 401, counted as a failed attempt.
    await c
      .changePassword(
        s.accessToken,
        { currentPassword: 'wrong password!!', newPassword: NEW_PASSWORD },
        s.refresh,
        CSRF,
      )
      .expect(401);

    await c
      .changePassword(
        s.accessToken,
        {
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
        },
        s.refresh,
        CSRF,
      )
      .expect(204);

    await c.refresh(s.refresh).expect(200); // kept
    await c.refresh(otherCookie).expect(401); // revoked

    const [row] = await dataSource.query<
      { failed_login_count: number; password_changed_at: Date | null }[]
    >(
      `SELECT failed_login_count, password_changed_at FROM user_credentials WHERE user_id = $1`,
      [s.user.id],
    );
    expect(row.failed_login_count).toBe(0);
    expect(row.password_changed_at).not.toBeNull();

    // Audit: the stored body has no password (written asynchronously).
    let changes: Record<string, unknown> | undefined;
    for (let i = 0; i < 20 && !changes; i += 1) {
      const rows = await dataSource.query<
        { changes: Record<string, unknown> }[]
      >(
        `SELECT changes FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [s.user.id],
      );
      changes = rows[0]?.changes;
      if (!changes) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    expect(changes).toEqual({
      currentPassword: '[REDACTED]',
      newPassword: '[REDACTED]',
      confirmPassword: '[REDACTED]',
    });
    expect(JSON.stringify(changes)).not.toContain(NEW_PASSWORD);
  });

  it('change-password for a Supabase-only user still takes the legacy path (old validation, no local credential created)', async () => {
    const c = client();
    const email = newEmail('legacy-change');
    const user = await dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email,
      full_name: 'Legacy',
    });
    const { token } = await tokens.signAccessToken(user);
    // Old rule: confirmPassword is required on the legacy path.
    await c
      .changePassword(token, {
        currentPassword: 'Old password 1',
        newPassword: 'New password 2',
      })
      .expect(400);
    // Valid body: reaches Supabase (a placeholder here), which fails -> 400.
    await c
      .changePassword(token, {
        currentPassword: 'Old password 1',
        newPassword: 'New password 2',
        confirmPassword: 'New password 2',
      })
      .expect(400);
    const creds = await dataSource.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM user_credentials WHERE user_id = $1`,
      [user.id],
    );
    expect(creds[0].n).toBe(0);
  });

  it('per-email limit: the 11th login attempt for one email within 15 minutes -> 429, even from new IPs', async () => {
    const email = newEmail('email-limit');
    await client().register(email).expect(201);
    for (let i = 0; i < 10; i += 1) {
      await client()
        .login(email, i < 4 ? 'wrong password!!' : PASSWORD)
        .expect((res) => expect([200, 401]).toContain(res.status));
    }
    await client().login(email).expect(429);
    // Other emails are not affected.
    await client().login(newEmail('other')).expect(401);
  });

  it('per-IP limit: 30 logins per minute per client IP, then 429; another IP is fine', async () => {
    const c = client();
    for (let i = 0; i < 30; i += 1) {
      await c.login(`nobody-${i}-${randomUUID()}@example.test`).expect(401);
    }
    await c.login(`nobody-${randomUUID()}@example.test`).expect(429);
    await client().login(`nobody-${randomUUID()}@example.test`).expect(401);
  });

  it('JwtAuthGuard verifies the token once on routes that also use @UseGuards(JwtAuthGuard)', async () => {
    const s = await session('guard-once');
    const spy = jest.spyOn(strategy, 'validate');
    try {
      await client().me(s.accessToken).expect(200); // UsersController: global + @UseGuards
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Auth cookies in production mode (e2e, Phase 08)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
    AUTH_COOKIE_PATH: process.env.AUTH_COOKIE_PATH,
  };
  const email = `e2e-auth-prod-${randomUUID().slice(0, 8)}@example.test`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_COOKIE_SECURE = '';
    process.env.AUTH_COOKIE_PATH = ''; // -> default /backend-api/auth
    const created = await createE2eApp();
    app = created.app;
    dataSource = created.moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM users WHERE email = $1`, [email]);
    await app.close();
    Object.assign(process.env, saved);
  });

  it('both cookies are Secure, np_refresh has Path=/backend-api/auth, no Domain', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, full_name: 'Prod' })
      .expect(201);
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const refresh = mustCookie(res, 'np_refresh');
    const marker = mustCookie(res, 'np_logged_in');
    expect(refresh.attributes).toMatchObject({
      secure: '',
      httponly: '',
      samesite: 'Lax',
      path: '/backend-api/auth',
    });
    expect(marker.attributes).toMatchObject({
      secure: '',
      samesite: 'Lax',
      path: '/',
    });
    expect(refresh.attributes).not.toHaveProperty('domain');
    expect(marker.attributes).not.toHaveProperty('domain');

    const out = await request(server)
      .post('/api/auth/logout')
      .set(CSRF)
      .set('Cookie', `np_refresh=${refresh.value}`)
      .expect(204);
    const cleared = mustCookie(out, 'np_refresh');
    expect(isCleared(cleared)).toBe(true);
    expect(cleared.attributes).toMatchObject({
      secure: '',
      path: '/backend-api/auth',
    });
  });
});
