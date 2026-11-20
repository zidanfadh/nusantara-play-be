import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { SELF_REVIEW_REASON_MAX, SELF_REVIEW_REASON_MIN } from '../self-review';

export class PublishProtDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan?: string;

  /**
   * Phase 26: only when an admin_kpoti reviews / publishes a PROT they created. Required then (10 to 500
   * characters), written to audit_logs (PROT_SELF_REVIEW_OVERRIDE). Never personal data.
   */
  @IsOptional()
  @IsString()
  @Length(SELF_REVIEW_REASON_MIN, SELF_REVIEW_REASON_MAX)
  selfReviewOverrideReason?: string;
}
