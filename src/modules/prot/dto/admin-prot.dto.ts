import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Media fields an admin can remove one item from (Phase 25). */
export const ADMIN_MEDIA_FIELDS = [
  'fotoKegiatan',
  'videoKegiatan',
  'dokumenKurikulum',
  'fotoAlat',
  'urlPembelian',
] as const;
export type AdminMediaField = (typeof ADMIN_MEDIA_FIELDS)[number];

export const ADMIN_REASON_MIN_LENGTH = 5;
export const ADMIN_REASON_MAX_LENGTH = 500;

/** POST /api/admin/prot/:id/media/remove */
export class AdminRemoveMediaDto {
  @IsString()
  @IsIn(ADMIN_MEDIA_FIELDS, {
    message: `field must be one of: ${ADMIN_MEDIA_FIELDS.join(', ')}`,
  })
  field: AdminMediaField;

  /** The exact URL as stored in the record (copy it from GET /api/prot/:id). */
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url: string;

  /** Only for fotoAlat / urlPembelian: limit the search to this equipment item. Omitted = every item. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  peralatanIndex?: number;

  /** Why the item is removed (stored in audit_logs). Never paste personal data here. */
  @IsString()
  @MinLength(ADMIN_REASON_MIN_LENGTH)
  @MaxLength(ADMIN_REASON_MAX_LENGTH)
  reason: string;
}

/** POST /api/admin/prot/:id/revisi */
export class AdminMoveToRevisiDto {
  @IsString()
  @MinLength(ADMIN_REASON_MIN_LENGTH)
  @MaxLength(ADMIN_REASON_MAX_LENGTH)
  reason: string;
}
