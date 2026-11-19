/**
 * Idempotency keys of ledger rows (Phase 15). Built on the SERVER only, from
 * the authenticated user id and values the server looked up itself; never
 * from client input such as a client-sent key or nonce.
 *
 *   PROVINCE_ENTER:{userId}:{provinsiKode}
 *   PROT_VIEW:{userId}:{protId}
 *   PASPOR_STAMP:{userId}:{provinsiKode}
 *   ADMIN_ADJUST:{userId}:{random uuid}       (every adjustment is new)
 *
 * The XP row of a grant uses the base key; a POINTS row of the same grant
 * uses {base}:POINTS.
 */
import { randomUUID } from 'node:crypto';
import { RewardCurrency } from './entities/reward-ledger-entry.entity';
import { REWARD_RULE_CODES } from './rewards.rules';

export function buildRewardKey(
  ruleCode: string,
  userId: string,
  ref: string,
): string {
  const parts: [string, string][] = [
    ['ruleCode', ruleCode],
    ['userId', userId],
    ['ref', ref],
  ];
  for (const [name, value] of parts) {
    if (!value || value.includes(':')) {
      throw new Error(`Invalid reward key part: ${name}.`);
    }
  }
  return `${ruleCode}:${userId}:${ref}`;
}

/** Key of one currency row of a grant (see the file comment). */
export function keyForCurrency(
  baseKey: string,
  currency: RewardCurrency,
): string {
  return currency === 'XP' ? baseKey : `${baseKey}:POINTS`;
}

export function buildAdminAdjustKey(userId: string): string {
  return buildRewardKey(REWARD_RULE_CODES.adminAdjust, userId, randomUUID());
}
