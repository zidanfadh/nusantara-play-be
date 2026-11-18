/**
 * User shapes for API responses (Phase 06, P1).
 *
 * Rule: a @Public() endpoint returns other users ONLY as PublicUser.
 * Logged-in endpoints that return OTHER users' records strip the private
 * fields (supabase_user_id, last_login_at). The user's own record
 * (GET /users/me) is returned in full.
 *
 * The helpers take a structural type instead of the User entity so that
 * src/common does not depend on a feature module.
 */

/** The only user fields a public endpoint may return. */
export interface PublicUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  institution: string | null;
}

export const PUBLIC_USER_FIELDS: readonly (keyof PublicUser)[] = [
  'id',
  'full_name',
  'avatar_url',
  'institution',
];

/** Fields never returned for another user's record. */
export const PRIVATE_USER_FIELDS = [
  'supabase_user_id',
  'last_login_at',
] as const;

export type PrivateUserField = (typeof PRIVATE_USER_FIELDS)[number];

export type WithoutPrivateUserFields<T> = Omit<T, PrivateUserField>;

interface UserLike {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  institution?: string | null;
}

/** Maps a user record to the public shape; null/undefined -> null. */
export function toPublicUser(
  user: UserLike | null | undefined,
): PublicUser | null {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    full_name: user.full_name ?? '',
    avatar_url: user.avatar_url ?? null,
    institution: user.institution ?? null,
  };
}

/** Returns a plain copy of `record` without the given keys. */
export function omitFields<T extends object, K extends string>(
  record: T,
  fields: readonly K[],
): Omit<T, K> {
  const hidden = new Set<string>(fields);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!hidden.has(key)) {
      copy[key] = value;
    }
  }
  return copy as Omit<T, K>;
}

/**
 * Strips supabase_user_id and last_login_at from another user's record.
 * null/undefined pass through unchanged (optional relations).
 */
export function stripPrivateUserFields<T extends object>(
  user: T,
): WithoutPrivateUserFields<T>;
export function stripPrivateUserFields<T extends object>(
  user: T | null | undefined,
): WithoutPrivateUserFields<T> | null | undefined;
export function stripPrivateUserFields<T extends object>(
  user: T | null | undefined,
): WithoutPrivateUserFields<T> | null | undefined {
  if (!user) {
    return user;
  }
  return omitFields(user, PRIVATE_USER_FIELDS);
}
