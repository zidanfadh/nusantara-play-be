/**
 * Phase 09 email flows over HTTP: full AppModule on the local test database
 * (test/e2e-app.ts), emails captured by CapturingEmailService (never sent).
 * Every test uses its own client IP (X-Forwarded-For) so the per-IP limits
 * never interfere. The email work runs in the background; tests wait for it
 * with EmailFlowsService.whenIdle().
 */
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  EmailFlowsService,
  FORGOT_PASSWORD_RESPONSE,
  RESEND_VERIFICATION_RESPONSE,
  RESET_PASSWORD_RESPONSE,
  VERIFY_EMAIL_RESPONSE,
} from '../src/modules/auth-core/email-flows.service';
import { REGISTER_RESPONSE } from '../src/modules/auth-core/local-auth.service';
import { TokenService } from '../src/modules/auth-core/token.service';
import { User } from '../src/modules/users/entities/user.entity';
import { CapturingEmailService } from './capturing-email';
import { createE2eApp, parseSetCookies } from './e2e-app';

const ORIGIN = 'http://localhost:3001';
const CSRF = { 'X-Requested-With': 'nusantara-play', Origin: ORIGIN };
const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a brand new passphrase';

let ipSeq = 0;
const freshIp = () => `198.51.100.${100 + (ipSeq += 1)}`;

interface Body {
  [key: string]: unknown;
}

describe('Email verification and password reset (e2e, Phase 09)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let flows: EmailFlowsService;
  let tokens: TokenService;
  let email: CapturingEmailService;
  const emails: string[] = [];
  const logSpies: jest.SpyInstance[] = [];

  beforeAll(async () => {
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      logSpies.push(jest.spyOn(Logger.prototype, level));
    }
    const created = await createE2eApp();
    app = created.app;
    email = created.email;
    dataSource = created.moduleRef.get(DataSource);
    flows = created.moduleRef.get(EmailFlowsService);
    tokens = created.moduleRef.get(TokenService);
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
    logSpies.forEach((spy) => spy.mockRestore());
  });

  const newEmail = (label: string) => {
    const address = `e2e-mail-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(address);
    return address;
  };

  /** Everything the app logged so far, as one string. */
  const allLogs = () =>
    JSON.stringify(logSpies.map((spy) => spy.mock.calls as unknown[]));

  function client(ip = freshIp()) {
    const server = app.getHttpServer();
    const post = (path: string) =>
      request(server).post(`/api/auth/${path}`).set('X-Forwarded-For', ip);
    return {
      register: (address: string) =>
        post('register').send({
          email: address,
          password: PASSWORD,
          full_name: 'E2E Mail',
        }),
      login: (address: string, password = PASSWORD) =>
        post('login').send({ email: address, password }),
      refresh: (cookie: string) =>
        post('refresh').set(CSRF).set('Cookie', `np_refresh=${cookie}`),
      verify: (token: unknown) => post('verify-email').send({ token }),
      resend: (address: string) =>
        post('resend-verification').send({ email: address }),
      forgot: (address: string) =>
        post('forgot-password').send({ email: address }),
      reset: (token: unknown, newPassword = NEW_PASSWORD) =>
        post('reset-password').send({ token, newPassword }),
      changePassword: (accessToken: string, cookie: string, body: object) =>
        post('change-password')
          .set('Authorization', `Bearer ${accessToken}`)
          .set(CSRF)
          .set('Cookie', `np_refresh=${cookie}`)
          .send(body),
      me: (accessToken: string) =>
        request(server)
          .get('/api/users/me')
          .set('X-Forwarded-For', ip)
          .set('Authorization', `Bearer ${accessToken}`),
    };
  }

  const refreshCookieOf = (res: request.Response) =>
    parseSetCookies(res.headers['set-cookie']).find(
      (c) => c.name === 'np_refresh',
    )?.value as string;
  const accessOf = (res: request.Response) =>
    (res.body as { accessToken: string }).accessToken;

  it('register -> verification email (token never logged) -> verify-email -> /users/me emailVerified true', async () => {
    const c = client();
    const address = newEmail('verify');
    const reg = await c.register(address).expect(201);
    expect(reg.body).toEqual(REGISTER_RESPONSE);
    await flows.whenIdle();

    const [mail] = email.to(address);
    expect(mail.kind).toBe('verification');
    expect(mail.subject).toBe('Verifikasi email akun Nusantara Play Anda');
    const token = email.tokenFor(address, 'verification')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mail.text).toContain(
      `http://localhost:3001/verify-email?token=${token}`,
    );
    expect(mail.html).toContain(token);

    // Users may log in before verifying (owner decision).
    const login = await c.login(address).expect(200);
    expect((login.body as { user: Body }).user.emailVerified).toBe(false);
    const before = await c.me(accessOf(login)).expect(200);
    expect((before.body as Body).emailVerified).toBe(false);

    const verified = await c.verify(token).expect(200);
    expect(verified.body).toEqual(VERIFY_EMAIL_RESPONSE);
    expect(verified.headers['cache-control']).toBe('no-store');

    const after = await c.me(accessOf(login)).expect(200);
    expect(after.body as Body).toMatchObject({
      email: address,
      emailVerified: true,
    });
    // Same object on login as on /users/me (existing fields kept).
    const relogin = await c.login(address).expect(200);
    expect(Object.keys((relogin.body as { user: Body }).user).sort()).toEqual(
      Object.keys(after.body as Body).sort(),
    );

    // Single use.
    const again = await c.verify(token).expect(400);
    expect(again.body).toMatchObject({
      statusCode: 400,
      code: 'invalid_or_expired_token',
    });

    // Already verified: resend sends nothing more.
    await c.resend(address).expect(200);
    await flows.whenIdle();
    expect(email.to(address)).toHaveLength(1);

    // No token, link or address in any log line.
    const logs = allLogs();
    expect(logs).not.toContain(token);
    expect(logs).not.toContain('verify-email?token');
    expect(logs.toLowerCase()).not.toContain(address.toLowerCase());
  });

  it('forgot -> reset email -> reset-password: old password fails, new works, old refresh cookie 401, access token from before the reset 401', async () => {
    const c = client();
    const address = newEmail('reset');
    await c.register(address).expect(201);
    const login = await c.login(address).expect(200);
    const oldCookie = refreshCookieOf(login);
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: address });
    // An access token issued well before the reset (beyond the 5 s skew).
    const preReset = await tokens.signAccessToken(
      user,
      new Date(Date.now() - 60_000),
    );
    await c.me(preReset.token).expect(200);

    const forgot = await c.forgot(address.toUpperCase()).expect(200);
    expect(forgot.body).toEqual(FORGOT_PASSWORD_RESPONSE);
    await flows.whenIdle();
    const token = email.tokenFor(address, 'password_reset')!;
    const resetMail = email
      .to(address)
      .find((m) => m.kind === 'password_reset')!;
    expect(resetMail.subject).toBe('Atur ulang password Nusantara Play');
    expect(resetMail.text).toContain(
      `http://localhost:3001/reset-password?token=${token}`,
    );

    // Policy error: 400 and the token is NOT used up.
    await c.reset(token, 'short').expect(400);

    const reset = await c.reset(token).expect(200);
    expect(reset.body).toEqual(RESET_PASSWORD_RESPONSE);
    await flows.whenIdle();
    expect(email.to(address).map((m) => m.kind)).toEqual([
      'verification',
      'password_reset',
      'password_changed',
    ]);

    await c.login(address, PASSWORD).expect(401);
    const fresh = await c.login(address, NEW_PASSWORD).expect(200);
    // The reset link proves the address: verified now.
    expect((fresh.body as { user: Body }).user.emailVerified).toBe(true);
    await c.refresh(oldCookie).expect(401);
    await c.me(preReset.token).expect(401);
    await c.me(accessOf(fresh)).expect(200);

    // Single use.
    const reused = await c.reset(token, 'yet another passphrase').expect(400);
    expect(reused.body).toMatchObject({ code: 'invalid_or_expired_token' });

    const logs = allLogs();
    expect(logs).not.toContain(token);
    expect(logs).not.toContain('reset-password?token');
    expect(logs.toLowerCase()).not.toContain(address.toLowerCase());
  });

  it('unknown email: the same responses as a known one, and no email at all', async () => {
    const c = client();
    const known = newEmail('known');
    await c.register(known).expect(201);
    await flows.whenIdle();
    const unknown = `e2e-mail-nobody-${randomUUID().slice(0, 8)}@example.test`;
    const sentBefore = email.sent.length;

    const [fk, fu, rk, ru] = await Promise.all([
      c.forgot(known),
      c.forgot(unknown),
      c.resend(known),
      c.resend(unknown),
    ]);
    for (const res of [fk, fu]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(FORGOT_PASSWORD_RESPONSE);
    }
    for (const res of [rk, ru]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(RESEND_VERIFICATION_RESPONSE);
    }
    await flows.whenIdle();
    expect(email.to(unknown)).toHaveLength(0);
    // The known (unverified) address got one reset and one new verification.
    expect(email.sent.length - sentBefore).toBe(2);
  });

  it('registering an existing email: same 201 body, an "akun sudah ada" email, account unchanged', async () => {
    const c = client();
    const address = newEmail('dup');
    await c.register(address).expect(201);
    const second = await c.register(address.toUpperCase()).expect(201);
    expect(second.body).toEqual(REGISTER_RESPONSE);
    await flows.whenIdle();
    const kinds = email.to(address).map((m) => m.kind);
    expect(kinds).toEqual(['verification', 'account_exists']);
    const exists = email.to(address)[1];
    expect(exists.subject).toBe('Akun Nusantara Play Anda sudah ada');
    expect(exists.text).toContain('http://localhost:3001/login');
    expect(exists.text).not.toContain('token=');
    await c.login(address).expect(200);
  });

  it('rate limit: at most 3 reset emails per address per hour; the 4th request still answers 200', async () => {
    const address = newEmail('limit');
    await client().register(address).expect(201);
    await flows.whenIdle();
    for (let i = 0; i < 4; i += 1) {
      // A new client IP each time: the limit is per address, not per IP.
      const res = await client().forgot(address).expect(200);
      expect(res.body).toEqual(FORGOT_PASSWORD_RESPONSE);
      await flows.whenIdle();
    }
    const resets = email.to(address).filter((m) => m.kind === 'password_reset');
    expect(resets).toHaveLength(3);
    // Only the newest link works.
    const tokensSent = resets.map(
      (m) => /token=([A-Za-z0-9_-]+)/.exec(m.text)![1],
    );
    const c = client();
    await c.reset(tokensSent[0]).expect(400);
    await c.reset(tokensSent[2]).expect(200);
  });

  it('Phase 29: a link used twice answers reason "used" (verify-email and reset-password)', async () => {
    const c = client();
    const address = newEmail('used-twice');
    await c.register(address).expect(201);
    await flows.whenIdle();
    const verifyToken = email.tokenFor(address, 'verification')!;
    await c.verify(verifyToken).expect(200);
    const again = await c.verify(verifyToken).expect(400);
    expect(again.body).toMatchObject({
      code: 'invalid_or_expired_token',
      reason: 'used',
    });

    await c.forgot(address).expect(200);
    await flows.whenIdle();
    const resetToken = email.tokenFor(address, 'password_reset')!;
    await c.reset(resetToken).expect(200);
    const resetAgain = await c.reset(resetToken).expect(400);
    expect(resetAgain.body).toMatchObject({ reason: 'used' });
  });

  it('expired, unknown or wrong-type tokens: 400 invalid_or_expired_token', async () => {
    const c = client();
    const address = newEmail('expired');
    await c.register(address).expect(201);
    await flows.whenIdle();
    const verifyToken = email.tokenFor(address, 'verification')!;

    // A verification token is not a reset token (and vice versa).
    const wrongType = await c.reset(verifyToken).expect(400);
    expect(wrongType.body).toMatchObject({
      code: 'invalid_or_expired_token',
      reason: 'invalid', // Phase 29
    });

    await dataSource.query(
      `UPDATE auth_tokens SET expires_at = now() - interval '1 minute'
        WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [address],
    );
    const expired = await c.verify(verifyToken).expect(400);
    expect(expired.body).toMatchObject({
      statusCode: 400,
      code: 'invalid_or_expired_token',
      reason: 'expired', // Phase 29
      message: 'The link is invalid or has expired',
    });
    const unknown = await c.verify('x'.repeat(43)).expect(400);
    expect(unknown.body).toMatchObject({ reason: 'invalid' });
    // Validation: missing token / unknown fields.
    await c.verify(undefined).expect(400);
    await client().forgot('not-an-email').expect(400);
  });

  it('change-password: the own session keeps working through the next refresh; older access tokens die', async () => {
    const c = client();
    const address = newEmail('change');
    await c.register(address).expect(201);
    const login = await c.login(address).expect(200);
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: address });
    const old = await tokens.signAccessToken(
      user,
      new Date(Date.now() - 60_000),
    );

    await c
      .changePassword(accessOf(login), refreshCookieOf(login), {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      })
      .expect(204);
    await flows.whenIdle();
    expect(email.to(address).map((m) => m.kind)).toContain('password_changed');

    await c.me(old.token).expect(401);
    // The kept refresh family gives a fresh access token that works.
    const refreshed = await c.refresh(refreshCookieOf(login)).expect(200);
    await c.me(accessOf(refreshed)).expect(200);
  });
});
