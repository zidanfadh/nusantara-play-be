/**
 * Where "email verified" lives (Phase 09):
 *
 * - Accounts WITH a password: user_credentials.email_verified_at.
 * - Accounts WITHOUT a password (Supabase-only now, Google-only from Phase
 *   10): a row in email_verifications (method 'email_link' or 'google').
 *
 * emailVerified = credentials.email_verified_at IS NOT NULL
 *                 OR an email_verifications row exists.
 *
 * When a passwordless account later gets a password (password reset), the
 * reset sets user_credentials.email_verified_at too.
 */
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { UserCredential } from './entities/user-credential.entity';

/** Auth facts loaded together with the user by the local-jwt strategy. */
export interface UserAuthState {
  emailVerified: boolean;
  passwordChangedAt: Date | null;
}

/**
 * Attached to req.user by the local-jwt strategy. A symbol key: never
 * serialized into JSON responses, never saved by TypeORM.
 */
export const USER_AUTH_STATE = Symbol('userAuthState');

type WithAuthState = { [USER_AUTH_STATE]?: UserAuthState };

export function attachAuthState(user: User, state: UserAuthState): User {
  Object.defineProperty(user, USER_AUTH_STATE, {
    value: state,
    enumerable: false,
    configurable: true,
  });
  return user;
}

export function getAuthState(user: unknown): UserAuthState | undefined {
  if (!user || typeof user !== 'object') {
    return undefined;
  }
  return (user as WithAuthState)[USER_AUTH_STATE];
}

const VERIFIED_SQL = `(EXISTS (SELECT 1 FROM user_credentials c
                          WHERE c.user_id = $1 AND c.email_verified_at IS NOT NULL)
         OR EXISTS (SELECT 1 FROM email_verifications ev WHERE ev.user_id = $1)) AS verified`;

/** One query: is this user's email verified? */
export async function isEmailVerified(
  db: DataSource | EntityManager,
  userId: string,
): Promise<boolean> {
  const rows = await db.query<{ verified: boolean }[]>(
    `SELECT ${VERIFIED_SQL}`,
    [userId],
  );
  return rows[0]?.verified === true;
}

/**
 * emailVerified of an authenticated user: the state the local-jwt strategy
 * attached (no query), else one query (legacy Supabase tokens).
 */
export async function resolveEmailVerified(
  db: DataSource | EntityManager,
  user: Pick<User, 'id'>,
): Promise<boolean> {
  const state = getAuthState(user);
  if (state) {
    return state.emailVerified;
  }
  return isEmailVerified(db, user.id);
}

/**
 * The user plus its auth state in ONE query (users LEFT JOIN
 * user_credentials LEFT JOIN email_verifications). Used by the local-jwt
 * strategy on every request. null for an unknown id.
 */
export async function loadUserWithAuthState(
  users: Repository<User>,
  userId: string,
): Promise<{ user: User; state: UserAuthState } | null> {
  const { entities, raw } = await users
    .createQueryBuilder('u')
    .leftJoin(UserCredential, 'auth_c', 'auth_c.user_id = u.id')
    .leftJoin(EmailVerification, 'auth_ev', 'auth_ev.user_id = u.id')
    .addSelect('auth_c.password_changed_at', 'auth_password_changed_at')
    .addSelect(
      '(auth_c.email_verified_at IS NOT NULL OR auth_ev.user_id IS NOT NULL)',
      'auth_email_verified',
    )
    .where('u.id = :userId', { userId })
    .getRawAndEntities<{
      auth_password_changed_at: Date | string | null;
      auth_email_verified: boolean;
    }>();
  const user = entities[0];
  if (!user) {
    return null;
  }
  const row = raw[0];
  const changed = row?.auth_password_changed_at ?? null;
  return {
    user,
    state: {
      emailVerified: row?.auth_email_verified === true,
      passwordChangedAt: changed === null ? null : new Date(changed),
    },
  };
}
