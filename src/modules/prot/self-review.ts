import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';

/**
 * Phase 26: nobody verifies, curates or publishes a PROT they created (Phase 25 finding: a reviewer approved their
 * own record in 44 seconds). Pure; used by VerifikasiService (pick, review) and PROTService (publish).
 *
 * - Not the creator: allowed.
 * - The creator, any role except admin_kpoti: refused (403), at every step.
 * - The creator is admin_kpoti: the queue claim ("pick") is allowed; the review decision and the publish need an
 *   explicit `selfReviewOverrideReason` (10 to 500 characters, validated by the DTOs). The caller writes one
 *   `audit_logs` row (`AUDIT_SELF_REVIEW_OVERRIDE`) BEFORE the decision, so no override happens without a record.
 */
export const AUDIT_SELF_REVIEW_OVERRIDE = 'PROT_SELF_REVIEW_OVERRIDE';
export const SELF_REVIEW_REASON_MIN = 10;
export const SELF_REVIEW_REASON_MAX = 500;

export type SelfReviewStep = 'pick' | 'review' | 'publish';

export interface SelfReviewInput {
  creatorId: string | null | undefined;
  actor: { id: string; role?: UserRole | string | null };
  step: SelfReviewStep;
  overrideReason?: string | null;
}

/** Returns `{ override: true, reason }` when an admin overrides the rule; throws ForbiddenException when refused. */
export function checkSelfReview(input: SelfReviewInput): {
  override: boolean;
  reason: string | null;
} {
  const { creatorId, actor, step } = input;
  if (!creatorId || creatorId !== actor.id) {
    return { override: false, reason: null };
  }

  if (actor.role !== UserRole.ADMIN_KPOTI) {
    throw new ForbiddenException(
      step === 'publish'
        ? 'Anda tidak bisa menerbitkan PROT buatan sendiri'
        : 'Anda tidak bisa memeriksa PROT buatan sendiri; PROT ini harus diperiksa orang lain',
    );
  }

  if (step === 'pick') {
    return { override: false, reason: null };
  }

  const reason = (input.overrideReason ?? '').trim();
  if (reason.length < SELF_REVIEW_REASON_MIN) {
    throw new ForbiddenException(
      'PROT ini buatan Anda sendiri. Admin hanya boleh melanjutkan dengan alasan tertulis (selfReviewOverrideReason, minimal 10 karakter)',
    );
  }
  return { override: true, reason };
}
