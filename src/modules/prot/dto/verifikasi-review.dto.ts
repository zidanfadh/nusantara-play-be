import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  IsArray,
  Length,
} from 'class-validator';
import { VerifikasiStatus } from '../entities/verifikasi.entity';
import { SELF_REVIEW_REASON_MAX, SELF_REVIEW_REASON_MIN } from '../self-review';

export class VerifikasiReviewDto {
  @IsNotEmpty()
  @IsEnum(VerifikasiStatus)
  status: VerifikasiStatus;

  @IsOptional()
  @IsString()
  catatan?: string;

  @ValidateIf((o) => o.status === VerifikasiStatus.REVISION_NEEDED)
  @IsNotEmpty({
    message: 'Saran perbaikan wajib diisi jika status REVISION_NEEDED',
  })
  @IsString()
  saran_perbaikan?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dokumen_pendukung?: string[];

  /**
   * Phase 26: only when an admin_kpoti reviews / publishes a PROT they created. Required then (10 to 500
   * characters), written to audit_logs (PROT_SELF_REVIEW_OVERRIDE). Never personal data.
   */
  @IsOptional()
  @IsString()
  @Length(SELF_REVIEW_REASON_MIN, SELF_REVIEW_REASON_MAX)
  selfReviewOverrideReason?: string;
}
