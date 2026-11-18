/**
 * Small helpers shared by LocalAuthService (Phase 08) and EmailFlowsService
 * (Phase 09): email normalization, the case-insensitive user lookup and the
 * password policy check.
 */
import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { checkPasswordPolicy } from './password.service';

/** Every email is trimmed and lower-cased before any lookup or insert. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Users whose email matches case-insensitively (LOWER(email) =
 * LOWER(:email)). At most 2 rows: callers only need "0, 1 or several".
 * There is deliberately no unique index on lower(email): production may
 * contain case variants of one address.
 */
export function findUsersByEmail(
  manager: EntityManager,
  email: string,
): Promise<User[]> {
  return manager
    .getRepository(User)
    .createQueryBuilder('u')
    .where('LOWER(u.email) = LOWER(:email)', { email: normalizeEmail(email) })
    .orderBy('u.created_at', 'ASC')
    .limit(2)
    .getMany();
}

export const POLICY_MESSAGES = {
  too_short: 'Password must be at least 8 characters long',
  too_long: 'Password must be at most 128 characters long',
  equals_email: 'Password must not be the same as the email address',
} as const;

/** 400 with the policy message when the password breaks the policy. */
export function assertPasswordPolicy(
  password: string,
  email?: string | null,
): void {
  const policy = checkPasswordPolicy(password, email);
  if (!policy.ok) {
    throw new BadRequestException(POLICY_MESSAGES[policy.reason]);
  }
}
