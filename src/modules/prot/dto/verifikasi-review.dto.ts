import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  IsArray,
} from 'class-validator';
import { VerifikasiStatus } from '../entities/verifikasi.entity';

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
}
