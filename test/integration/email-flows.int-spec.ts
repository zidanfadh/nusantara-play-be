/**
 * Phase 09 email flows against the real local test database: single-use
 * tokens under parallel load, invalidation of older tokens, the reset
 * (refresh tokens revoked, lockout cleared), the self-service migration of a
 * Supabase-only account through a reset, verification of accounts with and
 * without a password, and the cleanup. Emails go to a capturing double.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { AuthTokenService } from '../../src/modules/auth-core/auth-token.service';
import { InvalidOrExpiredTokenError } from '../../src/modules/auth-core/auth-errors';
import { EmailFlowsService } from '../../src/modules/auth-core/email-flows.service';
import { EmailSendLimiter } from '../../src/modules/auth-core/email-send-limiter.service';
import { isEmailVerified } from '../../src/modules/auth-core/email-verification';
import { AuthToken } from '../../src/modules/auth-core/entities/auth-token.entity';
import { EmailVerification } from '../../src/modules/auth-core/entities/email-verification.entity';
import { RefreshToken } from '../../src/modules/auth-core/entities/refresh-token.entity';
import { UserCredential } from '../../src/modules/auth-core/entities/user-credential.entity';
import { KeyService } from '../../src/modules/auth-core/key.service';
import { LocalAuthService } from '../../src/modules/auth-core/local-auth.service';
import { PasswordService } from '../../src/modules/auth-core/password.service';
import { RefreshTokenService } from '../../src/modules/auth-core/refresh-token.service';
import { TokenService } from '../../src/modules/auth-core/token.service';
import { EmailService } from '../../src/modules/notifications/email.service';
import { User } from '../../src/modules/users/entities/user.entity';
import { CapturingEmailService } from '../capturing-email';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a brand new passphrase';

describe('Email flows (integration, real database, Phase 09)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let tokens: AuthTokenService;
  let flows: EmailFlowsService;
  let auth: LocalAuthService;
  let refresh: RefreshTokenService;
  const email = new CapturingEmailService();
  const emails: string[] = [];

  const newEmail = (label: string) => {
    const address = `int-mail-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(address);
    return address;
  };
  const credentialOf = (userId: string) =>
    dataSource.getRepository(UserCredential).findOneBy({ user_id: userId });
  const tokensOf = (userId: string) =>
    dataSource.getRepository(AuthToken).findBy({ user_id: userId });

  async function registered(label: string): Promise<User> {
    const address = newEmail(label);
    await auth.register({
      email: address,
      password: PASSWORD,
      full_name: label,
    });
    await flows.whenIdle();
    return dataSource.getRepository(User).findOneByOrFail({ email: address });
  }

  /** Supabase-only account: users row with a Supabase id, no credentials. */
  async function supabaseOnly(label: string): Promise<User> {
    return dataSource.getRepository(User).save({
      email: newEmail(label),
      full_name: `INT ${label}`,
      supabase_user_id: randomUUID(),
    });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
        TypeOrmModule.forFeature([
          User,
          UserCredential,
          RefreshToken,
          AuthToken,
          EmailVerification,
        ]),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      providers: [
        KeyService,
        TokenService,
        PasswordService,
        RefreshTokenService,
        AuthTokenService,
        EmailSendLimiter,
        EmailFlowsService,
        LocalAuthService,
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
    tokens = moduleRef.get(AuthTokenService);
    flows = moduleRef.get(EmailFlowsService);
    auth = moduleRef.get(LocalAuthService);
    refresh = moduleRef.get(RefreshTokenService);
  });

  afterAll(async () => {
    // Credentials, tokens and verifications cascade with the user.
    if (emails.length) {
      await dataSource.query(`DELETE FROM users WHERE LOWER(email) = ANY($1)`, [
        emails.map((e) => e.toLowerCase()),
      ]);
    }
    await moduleRef.close();
  });

  it('two parallel consumes of the same token: exactly one succeeds', async () => {
    const user = await supabaseOnly('race');
    const { token } = await tokens.create(user.id, 'email_verification');
    const results = await Promise.all([
      tokens.consume(token, 'email_verification'),
      tokens.consume(token, 'email_verification'),
      tokens.consume(token, 'email_verification'),
    ]);
    expect(results.filter((r) => r === user.id)).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(2);
  });

  it('two parallel verify-email calls with one token: one 200, one invalid_or_expired_token', async () => {
    const user = await registered('verify-race');
    const token = email.tokenFor(user.email, 'verification')!;
    const results = await Promise.allSettled([
      flows.verifyEmail(token),
      flows.verifyEmail(token),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(InvalidOrExpiredTokenError);
  });

  it('a new token invalidates the older unused ones of the same type only', async () => {
    const user = await supabaseOnly('invalidate');
    const first = await tokens.create(user.id, 'password_reset');
    const verification = await tokens.create(user.id, 'email_verification');
    const second = await tokens.create(user.id, 'password_reset');
    await expect(
      tokens.consume(first.token, 'password_reset'),
    ).resolves.toBeNull();
    await expect(tokens.consume(second.token, 'password_reset')).resolves.toBe(
      user.id,
    );
    await expect(
      tokens.consume(verification.token, 'email_verification'),
    ).resolves.toBe(user.id);
    // Only hashes in the table, never the raw token.
    const rows = await tokensOf(user.id);
    expect(rows.map((r) => r.token_hash)).not.toContain(second.token);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  it('a token of one type never works for the other; an expired token never works', async () => {
    const user = await supabaseOnly('types');
    const reset = await tokens.create(user.id, 'password_reset');
    await expect(
      tokens.consume(reset.token, 'email_verification'),
    ).resolves.toBeNull();
    await dataSource.query(
      `UPDATE auth_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [user.id],
    );
    await expect(
      tokens.consume(reset.token, 'password_reset'),
    ).resolves.toBeNull();
  });

  it('expires_at follows the lifetimes (24 h verification, 60 min reset)', async () => {
    const user = await supabaseOnly('ttl');
    const before = Date.now();
    const v = await tokens.create(user.id, 'email_verification');
    const r = await tokens.create(user.id, 'password_reset');
    const hours = (v.expiresAt.getTime() - before) / 3_600_000;
    const minutes = (r.expiresAt.getTime() - before) / 60_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThan(61);
  });

  it('reset revokes ALL refresh tokens, clears the lockout, sets password_changed_at and email_verified_at', async () => {
    const user = await registered('reset');
    await refresh.issue(user.id);
    await refresh.issue(user.id);
    for (let i = 0; i < 5; i += 1) {
      await auth.recordFailedAttempt(user.id);
    }
    const locked = await credentialOf(user.id);
    expect(locked?.locked_until).not.toBeNull();
    expect(locked?.email_verified_at).toBeNull();

    flows.requestPasswordReset(user.email);
    await flows.whenIdle();
    const token = email.tokenFor(user.email, 'password_reset')!;
    expect(token).toBeTruthy();
    await flows.resetPassword(token, NEW_PASSWORD);
    await flows.whenIdle();

    const credential = await credentialOf(user.id);
    expect(credential?.failed_login_count).toBe(0);
    expect(credential?.locked_until).toBeNull();
    expect(credential?.password_changed_at).not.toBeNull();
    expect(credential?.email_verified_at).not.toBeNull();
    expect(credential?.password_algo).toBe('argon2id');
    const active = await dataSource.query<{ n: string }[]>(
      `SELECT count(*) AS n FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id],
    );
    expect(active[0].n).toBe('0');
    const reasons = await dataSource.query<{ revoked_reason: string }[]>(
      `SELECT DISTINCT revoked_reason FROM refresh_tokens WHERE user_id = $1`,
      [user.id],
    );
    expect(reasons.map((r) => r.revoked_reason)).toEqual(['password_reset']);
    expect(email.to(user.email).map((m) => m.kind)).toEqual([
      'verification',
      'password_reset',
      'password_changed',
    ]);

    // The account was locked; the reset is the way back in.
    await expect(auth.login(user.email, PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.login(user.email, NEW_PASSWORD)).resolves.toMatchObject({
      user: { id: user.id, emailVerified: true },
    });
    // The token is single-use.
    await expect(
      flows.resetPassword(token, 'yet another passphrase'),
    ).rejects.toBeInstanceOf(InvalidOrExpiredTokenError);
  });

  it('reset of a Supabase-only account creates local credentials; the user can then log in', async () => {
    const user = await supabaseOnly('migrate');
    expect(await credentialOf(user.id)).toBeNull();
    await expect(auth.login(user.email, NEW_PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    flows.requestPasswordReset(user.email.toUpperCase());
    await flows.whenIdle();
    const token = email.tokenFor(user.email, 'password_reset')!;
    await flows.resetPassword(token, NEW_PASSWORD);

    const credential = await credentialOf(user.id);
    expect(credential).toMatchObject({
      password_algo: 'argon2id',
      failed_login_count: 0,
      locked_until: null,
    });
    expect(credential?.email_verified_at).not.toBeNull();
    expect(credential?.password_changed_at).not.toBeNull();
    const session = await auth.login(user.email, NEW_PASSWORD);
    expect(session.user).toMatchObject({
      id: user.id,
      supabase_user_id: user.supabase_user_id,
      emailVerified: true,
    });
  });

  it('verify-email: password account -> user_credentials.email_verified_at; Supabase-only -> email_verifications', async () => {
    const local = await registered('verify-local');
    expect(await isEmailVerified(dataSource, local.id)).toBe(false);
    await flows.verifyEmail(email.tokenFor(local.email, 'verification')!);
    expect((await credentialOf(local.id))?.email_verified_at).not.toBeNull();
    expect(await isEmailVerified(dataSource, local.id)).toBe(true);

    const legacy = await supabaseOnly('verify-legacy');
    flows.requestVerification(legacy.email);
    await flows.whenIdle();
    await flows.verifyEmail(email.tokenFor(legacy.email, 'verification')!);
    expect(await credentialOf(legacy.id)).toBeNull();
    const rows = await dataSource
      .getRepository(EmailVerification)
      .findBy({ user_id: legacy.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe('email_link');
    expect(await isEmailVerified(dataSource, legacy.id)).toBe(true);

    // Verified accounts get no further verification email.
    const before = email.to(legacy.email).length;
    flows.requestVerification(legacy.email);
    await flows.whenIdle();
    expect(email.to(legacy.email)).toHaveLength(before);
  });

  it('cleanup deletes tokens used or expired more than 7 days ago and keeps the rest', async () => {
    const user = await supabaseOnly('cleanup');
    const fresh = await tokens.create(user.id, 'email_verification');
    await tokens.create(user.id, 'password_reset');
    await dataSource.query(
      `UPDATE auth_tokens SET expires_at = now() - interval '8 days'
        WHERE user_id = $1 AND type = 'password_reset'`,
      [user.id],
    );
    const deleted = await tokens.cleanup();
    expect(deleted).toBeGreaterThanOrEqual(1);
    const left = await tokensOf(user.id);
    expect(left.map((t) => t.type)).toEqual(['email_verification']);
    await expect(
      tokens.consume(fresh.token, 'email_verification'),
    ).resolves.toBe(user.id);
  });
});
