import {
  omitFields,
  stripPrivateUserFields,
} from '../../common/serializers/user-shape';
import { User, UserRole } from './entities/user.entity';

/**
 * How the users module returns ANOTHER user's record (Phase 06, P1).
 *
 * - admin_kpoti (user management): everything except supabase_user_id;
 *   last_login_at stays because the admin user table shows it.
 * - everyone else (kurator_daerah on GET /users/:id): without
 *   supabase_user_id and last_login_at.
 *
 * The caller's own record (GET/PATCH /users/me) is not passed through here.
 */
export function toUserViewFor(
  viewer: Pick<User, 'role'>,
  user: User,
): Partial<User> {
  if (viewer.role === UserRole.ADMIN_KPOTI) {
    return omitFields(user, ['supabase_user_id'] as const);
  }
  return stripPrivateUserFields(user);
}
