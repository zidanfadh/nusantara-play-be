import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthConfig, readAuthConfig } from '../../config/auth.config';
import {
  accountExistsEmail,
  EmailService,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from '../notifications';
import { User } from '../users/entities/user.entity';
import { InvalidOrExpiredTokenError } from './auth-errors';
import { AuthTokenService } from './auth-token.service';
import {
  assertPasswordPolicy,
  findUsersByEmail,
  normalizeEmail,
} from './auth-users';
import { EmailSendLimiter } from './email-send-limiter.service';
import { isEmailVerified } from './email-verification';
import { AUTH_TOKEN_TYPES } from './entities/auth-token.entity';
import { UserCredential } from './entities/user-credential.entity';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

/** The ONE answer of POST /auth/resend-verification. */
export const RESEND_VERIFICATION_RESPONSE = Object.freeze({
  success: true,
  message:
    'If this email belongs to an account that still needs verification, we have sent a new verification link. Check your inbox.',
});

/** The ONE answer of POST /auth/forgot-password. */
export const FORGOT_PASSWORD_RESPONSE = Object.freeze({
  success: true,
  message:
    'If an account with this email exists, we have sent a link to reset the password. Check your inbox.',
});

export const VERIFY_EMAIL_RESPONSE = Object.freeze({
  success: true,
  message: 'Email address verified.',
});

export const RESET_PASSWORD_RESPONSE = Object.freeze({
  success: true,
  message:
    'Password has been reset. You can now sign in with the new password.',
});

export const PASSWORD_RESET_REVOKE_REASON = 'password_reset';

type MailUser = Pick<User, 'id' | 'email'> & Partial<Pick<User, 'full_name'>>;

/**
 * Email verification and password reset (Phase 09).
 *
 * Everything that sends an email runs in the BACKGROUND after the request
 * answered (registration hooks, resend-verification, forgot-password,
 * "password changed"): the response body AND its timing are the same whether
 * or not an account exists. Failures are logged (error name only) and never
 * reach the client. whenIdle() waits for queued work (tests, shutdown).
 *
 * Never logs an email address, a token or a link.
 */
@Injectable()
export class EmailFlowsService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailFlowsService.name);
  private readonly config: AuthConfig;
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly authTokens: AuthTokenService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly email: EmailService,
    private readonly limiter: EmailSendLimiter,
    @Optional() configService?: ConfigService,
  ) {
    this.config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
  }

  // ------------------------------------------------------ background tasks

  /** Waits until every queued email task finished. */
  async whenIdle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.whenIdle();
  }

  private background(label: string, task: () => Promise<void>): void {
    const run = (async () => {
      try {
        await task();
      } catch (error) {
        this.logger.error(
          `Background ${label} task failed (${(error as Error)?.name ?? 'UnknownError'})`,
        );
      }
    })();
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
  }

  // ----------------------------------------------------- registration hooks

  /** New account: send the verification link. */
  onRegistered(user: MailUser, ip: string | null = null): void {
    this.background('verification', async () => {
      if (
        !(await this.limiter.tryConsume(
          'verification',
          normalizeEmail(user.email),
        ))
      ) {
        return;
      }
      await this.sendVerification(user, ip);
    });
  }

  /**
   * Existing email: send "akun Anda sudah ada" (how to sign in or use "Lupa
   * password"). Several case-variant accounts: nothing (logged without the
   * email). The existing account is never changed.
   */
  onDuplicateRegistration(email: string): void {
    const normalized = normalizeEmail(email);
    this.background('account-exists', async () => {
      if (!(await this.limiter.tryConsume('verification', normalized))) {
        return;
      }
      const matches = await findUsersByEmail(
        this.dataSource.manager,
        normalized,
      );
      if (matches.length !== 1) {
        return;
      }
      const content = accountExistsEmail({
        fullName: matches[0].full_name,
        loginUrl: this.config.appPublicUrl
          ? `${this.config.appPublicUrl}/login`
          : null,
      });
      await this.email.sendTransactional({
        kind: 'account_exists',
        to: matches[0].email,
        ...content,
      });
    });
  }

  // ------------------------------------------------- resend-verification

  /**
   * Sends a new verification link only when exactly one account matches and
   * it is not verified yet. The caller always answers
   * RESEND_VERIFICATION_RESPONSE.
   */
  requestVerification(email: string, ip: string | null = null): void {
    const normalized = normalizeEmail(email);
    this.background('resend-verification', async () => {
      if (!(await this.limiter.tryConsume('verification', normalized))) {
        return;
      }
      const user = await this.singleUser(normalized, 'Resend verification');
      if (!user || (await isEmailVerified(this.dataSource, user.id))) {
        return;
      }
      await this.sendVerification(user, ip);
    });
  }

  // ------------------------------------------------------- forgot-password

  /**
   * Sends a reset link when exactly one account matches (any account,
   * Supabase-only included: completing the reset creates its local
   * password). The caller always answers FORGOT_PASSWORD_RESPONSE.
   */
  requestPasswordReset(email: string, ip: string | null = null): void {
    const normalized = normalizeEmail(email);
    this.background('password-reset', async () => {
      if (!(await this.limiter.tryConsume('password_reset', normalized))) {
        return;
      }
      const user = await this.singleUser(normalized, 'Password reset');
      if (!user) {
        return;
      }
      const base = this.linkBase('Password reset');
      if (!base) {
        return;
      }
      const { token } = await this.authTokens.create(
        user.id,
        AUTH_TOKEN_TYPES.passwordReset,
        ip,
      );
      const content = passwordResetEmail({
        fullName: user.full_name,
        link: `${base}/reset-password?token=${encodeURIComponent(token)}`,
        ttlMinutes: this.authTokens.ttlMinutes(AUTH_TOKEN_TYPES.passwordReset),
      });
      await this.email.sendTransactional({
        kind: 'password_reset',
        to: user.email,
        ...content,
      });
    });
  }

  // ---------------------------------------------------------- verify-email

  /**
   * Consumes the token and records the verification in the same
   * transaction: user_credentials.email_verified_at for accounts with a
   * password, else an email_verifications row (method 'email_link').
   * 400 invalid_or_expired_token for any unusable token.
   */
  async verifyEmail(rawToken: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userId = await this.authTokens.consume(
        rawToken,
        AUTH_TOKEN_TYPES.emailVerification,
        manager,
      );
      if (!userId) {
        throw new InvalidOrExpiredTokenError();
      }
      const updated = await manager
        .createQueryBuilder()
        .update(UserCredential)
        .set({ email_verified_at: () => 'COALESCE(email_verified_at, now())' })
        .where('user_id = :userId', { userId })
        .execute();
      if (!updated.affected) {
        await manager.query(
          `INSERT INTO email_verifications (user_id, method)
           VALUES ($1, 'email_link')
           ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );
      }
    });
  }

  // -------------------------------------------------------- reset-password

  /**
   * 1. Password policy (length first; "not the email" once the token's user
   *    is known). 2. The token must be valid (read-only check).
   * 3. One transaction: consume the token (race-safe), create or update
   *    user_credentials (Argon2id, password_changed_at, email_verified_at if
   *    null, lockout cleared) and revoke ALL refresh tokens.
   * Then (background) the "password Anda telah diubah" email.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    assertPasswordPolicy(newPassword);
    const peekedUserId = await this.authTokens.peek(
      rawToken,
      AUTH_TOKEN_TYPES.passwordReset,
    );
    if (!peekedUserId) {
      throw new InvalidOrExpiredTokenError();
    }
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: peekedUserId });
    if (!user) {
      throw new InvalidOrExpiredTokenError();
    }
    assertPasswordPolicy(newPassword, user.email);
    const hash = await this.passwords.hash(newPassword);
    const changedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      const userId = await this.authTokens.consume(
        rawToken,
        AUTH_TOKEN_TYPES.passwordReset,
        manager,
      );
      if (!userId) {
        throw new InvalidOrExpiredTokenError();
      }
      await manager.query(
        `INSERT INTO user_credentials
           (user_id, password_hash, password_algo, email_verified_at,
            failed_login_count, locked_until, password_changed_at)
         VALUES ($1, $2, 'argon2id', $3, 0, NULL, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           password_algo = 'argon2id',
           password_changed_at = EXCLUDED.password_changed_at,
           email_verified_at = COALESCE(user_credentials.email_verified_at,
                                        EXCLUDED.email_verified_at),
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()`,
        [userId, hash, changedAt],
      );
      await this.refreshTokens.revokeAllForUser(
        userId,
        PASSWORD_RESET_REVOKE_REASON,
        manager,
      );
    });
    this.notifyPasswordChanged(user);
  }

  // -------------------------------------------------------- password changed

  /** "password Anda telah diubah" after a reset or a local change-password. */
  notifyPasswordChanged(user: MailUser): void {
    this.background('password-changed', async () => {
      const content = passwordChangedEmail({ fullName: user.full_name });
      await this.email.sendTransactional({
        kind: 'password_changed',
        to: user.email,
        ...content,
      });
    });
  }

  // ----------------------------------------------------------------- helpers

  private async sendVerification(
    user: MailUser,
    ip: string | null,
  ): Promise<void> {
    const base = this.linkBase('Verification');
    if (!base) {
      return;
    }
    const { token } = await this.authTokens.create(
      user.id,
      AUTH_TOKEN_TYPES.emailVerification,
      ip,
    );
    const content = verificationEmail({
      fullName: user.full_name,
      link: `${base}/verify-email?token=${encodeURIComponent(token)}`,
      ttlMinutes: this.authTokens.ttlMinutes(
        AUTH_TOKEN_TYPES.emailVerification,
      ),
    });
    await this.email.sendTransactional({
      kind: 'verification',
      to: user.email,
      ...content,
    });
  }

  private linkBase(label: string): string | null {
    if (!this.config.appPublicUrl) {
      this.logger.warn(
        `${label} email not sent: APP_PUBLIC_URL is not set or invalid`,
      );
    }
    return this.config.appPublicUrl;
  }

  /** Exactly one matching user, else null (several: warning without email). */
  private async singleUser(
    normalizedEmail: string,
    label: string,
  ): Promise<User | null> {
    const matches = await findUsersByEmail(
      this.dataSource.manager,
      normalizedEmail,
    );
    if (matches.length > 1) {
      this.logger.warn(
        `${label} refused: several users match one normalized email`,
      );
      return null;
    }
    return matches[0] ?? null;
  }
}
