import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuthConfig, readAuthConfig } from '../../config/auth.config';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { RefreshTokenInvalidError } from './auth-errors';
import { UserCredential } from './entities/user-credential.entity';
import { checkPasswordPolicy, PasswordService } from './password.service';
import {
  IssuedRefreshToken,
  RefreshTokenMeta,
  RefreshTokenService,
} from './refresh-token.service';
import { TokenService } from './token.service';

/** Generic 401 for every failed login (unknown email, wrong password, locked, no password). */
export const LOGIN_FAILED_MESSAGE = 'Invalid email or password';
/** Generic 403 for a correct password on a suspended or inactive account. */
export const ACCOUNT_UNAVAILABLE_MESSAGE = 'This account cannot sign in';
/** 401 for a wrong (or locked) current password on change-password. */
export const CURRENT_PASSWORD_MESSAGE =
  'Current password is incorrect or the account is temporarily locked';
export const LOCAL_AUTH_UNAVAILABLE_MESSAGE =
  'Sign-in is temporarily unavailable';

/**
 * The ONE response of POST /auth/register: identical for a new account, an
 * existing account (with or without a password, Supabase-only included) and
 * a lost registration race, so it never reveals whether an email exists.
 */
export const REGISTER_RESPONSE = Object.freeze({
  success: true,
  message:
    'Registration received. If this email can be used, you can now sign in. Check your inbox for further steps.',
});

export const REVOKE_REASONS = {
  logout: 'logout',
  logoutAll: 'logout_all',
  passwordChanged: 'password_changed',
  userUnavailable: 'user_unavailable',
} as const;

const POLICY_MESSAGES = {
  too_short: 'Password must be at least 8 characters long',
  too_long: 'Password must be at most 128 characters long',
  equals_email: 'Password must not be the same as the email address',
} as const;

const PG_UNIQUE_VIOLATION = '23505';

/** Every email is trimmed and lower-cased before any lookup or insert. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthSession {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Same shape as GET /api/users/me (the users row). */
  user: User;
  /** Raw refresh token: goes ONLY into the np_refresh cookie. */
  refreshToken: IssuedRefreshToken;
}

/**
 * Self-hosted login flows on top of the Phase 07 services (Phase 08):
 * register, login (lockout, rehash), refresh, logout, logout-all and the
 * local change-password. No Supabase dependency.
 */
@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);
  readonly config: AuthConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    @Optional() configService?: ConfigService,
  ) {
    this.config = readAuthConfig((key) =>
      configService ? configService.get<string>(key) : process.env[key],
    );
  }

  /**
   * Users whose email matches case-insensitively (LOWER(email) =
   * LOWER(:email)). At most 2 rows: callers only need "0, 1 or several".
   * There is deliberately no unique index on lower(email): production may
   * contain case variants of one address.
   */
  async findUsersByEmail(
    email: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<User[]> {
    return manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email: normalizeEmail(email) })
      .orderBy('u.created_at', 'ASC')
      .limit(2)
      .getMany();
  }

  async hasCredentials(userId: string): Promise<boolean> {
    return this.dataSource
      .getRepository(UserCredential)
      .existsBy({ user_id: userId });
  }

  // ---------------------------------------------------------------- register

  /**
   * Creates users + user_credentials in one transaction, ONLY when no user
   * has this email. An existing account is never changed (attaching a
   * password to it would allow an account takeover). The caller always
   * answers with REGISTER_RESPONSE.
   */
  async register(input: RegisterInput): Promise<void> {
    const email = normalizeEmail(input.email);
    this.assertPolicy(input.password, email);
    // Hash first in every branch, so the response time does not depend on
    // whether the email exists.
    const passwordHash = await this.passwords.hash(input.password);

    const matches = await this.findUsersByEmail(email);
    if (matches.length > 1) {
      this.logger.warn(
        'Registration refused: several users match one normalized email',
      );
    }
    if (matches.length > 0) {
      this.onDuplicateRegistration();
      return;
    }

    let userId: string;
    try {
      userId = await this.dataSource.transaction(async (manager) => {
        const inserted = await manager.getRepository(User).insert({
          email,
          full_name: input.full_name.trim(),
          role: UserRole.PUBLIK,
          status: UserStatus.ACTIVE,
          supabase_user_id: null,
        });
        const id = (inserted.identifiers[0] as { id: string }).id;
        await manager.getRepository(UserCredential).insert({
          user_id: id,
          password_hash: passwordHash,
          password_algo: 'argon2id',
        });
        return id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race with a parallel registration of the same email.
        this.onDuplicateRegistration();
        return;
      }
      throw error;
    }
    this.onRegistered(userId);
  }

  /**
   * ==== PHASE 09 HOOK: send the email verification link to the new user. ====
   * Called after the transaction committed. Must not change the HTTP
   * response (that would reveal which branch ran).
   */
  protected onRegistered(userId: string): void {
    void userId;
  }

  /**
   * ==== PHASE 09 HOOK: send the "you already have an account" email. ====
   * Called when the email already exists (or a parallel registration won).
   * Must not change the HTTP response.
   */
  protected onDuplicateRegistration(): void {}

  // ------------------------------------------------------------------- login

  async login(
    email: string,
    password: string,
    meta: RefreshTokenMeta = {},
  ): Promise<AuthSession> {
    this.assertEnabled();
    const matches = await this.findUsersByEmail(email);
    if (matches.length !== 1) {
      if (matches.length > 1) {
        this.logger.warn(
          'Login refused: several users match one normalized email',
        );
      }
      await this.passwords.verifyDummy(password);
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }
    const user = matches[0];

    const credential = await this.dataSource
      .getRepository(UserCredential)
      .findOneBy({ user_id: user.id });
    if (!credential) {
      // Supabase-only (not yet migrated) or passwordless account.
      await this.passwords.verifyDummy(password);
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }
    if (isLocked(credential)) {
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }

    const result = await this.passwords.verify(
      credential.password_hash,
      credential.password_algo,
      password,
    );
    if (!result.ok) {
      await this.recordFailedAttempt(user.id);
      throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);
    }

    await this.resetFailedAttempts(user.id);
    if (result.needsRehash) {
      await this.rehash(credential, password);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(ACCOUNT_UNAVAILABLE_MESSAGE);
    }

    const refreshToken = await this.refreshTokens.issue(user.id, meta);
    return this.completeSession(user.id, refreshToken);
  }

  /**
   * Atomic: failed_login_count = failed_login_count + 1 in SQL; when the new
   * count reaches LOGIN_MAX_FAILED the account is locked for
   * LOGIN_LOCK_MINUTES. The count is only reset by a correct password, so
   * after a lock expires the next wrong password locks again at once.
   */
  async recordFailedAttempt(
    userId: string,
  ): Promise<{ failedLoginCount: number; lockedUntil: Date | null }> {
    const rows = await this.dataSource.query<
      [{ failed_login_count: number; locked_until: Date | null }[], number]
    >(
      `UPDATE user_credentials
          SET failed_login_count = failed_login_count + 1,
              locked_until = CASE
                WHEN failed_login_count + 1 >= $2
                  THEN now() + make_interval(mins => $3::int)
                ELSE locked_until
              END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING failed_login_count, locked_until`,
      [userId, this.config.loginMaxFailed, this.config.loginLockMinutes],
    );
    const row = rows[0]?.[0];
    return {
      failedLoginCount: row?.failed_login_count ?? 0,
      lockedUntil: row?.locked_until ?? null,
    };
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_credentials
          SET failed_login_count = 0, locked_until = NULL, updated_at = now()
        WHERE user_id = $1 AND (failed_login_count <> 0 OR locked_until IS NOT NULL)`,
      [userId],
    );
  }

  /** Legacy bcrypt or old Argon2 parameters -> fresh Argon2id hash. */
  private async rehash(
    credential: UserCredential,
    password: string,
  ): Promise<void> {
    const newHash = await this.passwords.hash(password);
    // Conditional on the old hash: never overwrite a password that was
    // changed in parallel.
    await this.dataSource
      .createQueryBuilder()
      .update(UserCredential)
      .set({ password_hash: newHash, password_algo: 'argon2id' })
      .where('user_id = :userId AND password_hash = :oldHash', {
        userId: credential.user_id,
        oldHash: credential.password_hash,
      })
      .execute();
  }

  // ----------------------------------------------------------------- refresh

  /**
   * Rotates the refresh token (409 refresh_conflict / 401 from
   * RefreshTokenService). A user who is gone, suspended or inactive loses
   * the family and gets 401.
   */
  async refresh(
    rawToken: string | null,
    meta: RefreshTokenMeta = {},
  ): Promise<AuthSession> {
    this.assertEnabled();
    if (!rawToken) {
      throw new RefreshTokenInvalidError('unknown');
    }
    const issued = await this.refreshTokens.rotate(rawToken, meta);
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: issued.userId });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.refreshTokens.revokeFamily(
        issued.familyId,
        REVOKE_REASONS.userUnavailable,
      );
      throw new RefreshTokenInvalidError('revoked');
    }
    return this.completeSession(user.id, issued);
  }

  /** last_login_at (login AND refresh, owner decision), access token, user. */
  private async completeSession(
    userId: string,
    refreshToken: IssuedRefreshToken,
  ): Promise<AuthSession> {
    const users = this.dataSource.getRepository(User);
    await users.update({ id: userId }, { last_login_at: new Date() });
    const user = await users.findOneByOrFail({ id: userId });
    const access = await this.tokens.signAccessToken(user);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      user,
      refreshToken,
    };
  }

  // ------------------------------------------------------------------ logout

  /** Revokes the family of a valid refresh token; anything else is a no-op. */
  async logout(rawToken: string | null): Promise<void> {
    if (!rawToken) {
      return;
    }
    const row = await this.refreshTokens.findActive(rawToken);
    if (row) {
      await this.refreshTokens.revokeFamily(
        row.family_id,
        REVOKE_REASONS.logout,
      );
    }
  }

  async logoutAll(userId: string): Promise<number> {
    return this.refreshTokens.revokeAllForUser(
      userId,
      REVOKE_REASONS.logoutAll,
    );
  }

  // --------------------------------------------------------- change-password

  /**
   * Local change-password for users WITH user_credentials (the caller
   * checks hasCredentials()). Same lockout rules as login. Revokes every
   * refresh token of the user except the current session's family (when the
   * request carried its valid np_refresh cookie).
   */
  async changePassword(
    user: Pick<User, 'id' | 'email'>,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken: string | null,
  ): Promise<void> {
    const credential = await this.dataSource
      .getRepository(UserCredential)
      .findOneBy({ user_id: user.id });
    if (!credential) {
      throw new BadRequestException(
        'Password change is not available for this account',
      );
    }
    if (isLocked(credential)) {
      throw new UnauthorizedException(CURRENT_PASSWORD_MESSAGE);
    }
    const result = await this.passwords.verify(
      credential.password_hash,
      credential.password_algo,
      currentPassword,
    );
    if (!result.ok) {
      await this.recordFailedAttempt(user.id);
      throw new UnauthorizedException(CURRENT_PASSWORD_MESSAGE);
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }
    this.assertPolicy(newPassword, user.email);

    let keepFamilyId: string | null = null;
    if (currentRefreshToken) {
      const row = await this.refreshTokens.findActive(currentRefreshToken);
      if (row && row.user_id === user.id) {
        keepFamilyId = row.family_id;
      }
    }

    const newHash = await this.passwords.hash(newPassword);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UserCredential).update(
        { user_id: user.id },
        {
          password_hash: newHash,
          password_algo: 'argon2id',
          password_changed_at: new Date(),
          failed_login_count: 0,
          locked_until: null,
        },
      );
      await this.refreshTokens.revokeAllForUserExcept(
        user.id,
        REVOKE_REASONS.passwordChanged,
        keepFamilyId,
        manager,
      );
    });
  }

  // ----------------------------------------------------------------- helpers

  private assertPolicy(password: string, email: string): void {
    const policy = checkPasswordPolicy(password, email);
    if (!policy.ok) {
      throw new BadRequestException(POLICY_MESSAGES[policy.reason]);
    }
  }

  private assertEnabled(): void {
    if (!this.tokens.isEnabled()) {
      throw new ServiceUnavailableException(LOCAL_AUTH_UNAVAILABLE_MESSAGE);
    }
  }
}

function isLocked(credential: Pick<UserCredential, 'locked_until'>): boolean {
  return (
    !!credential.locked_until && credential.locked_until.getTime() > Date.now()
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      PG_UNIQUE_VIOLATION
  );
}
