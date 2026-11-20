import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PROT, PROTStatus } from './entities/prot.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { StorageService } from '../storage/storage.service';
import type { User } from '../users/entities/user.entity';
import type {
  AdminMediaField,
  AdminMoveToRevisiDto,
  AdminRemoveMediaDto,
} from './dto/admin-prot.dto';

type ActingAdmin = Pick<User, 'id'>;

/** Audit actions written by this service (audit_logs.action). */
export const AUDIT_ADMIN_MEDIA_REMOVE = 'ADMIN_PROT_MEDIA_REMOVE';
export const AUDIT_ADMIN_MOVE_TO_REVISI = 'ADMIN_PROT_MOVE_TO_REVISI';

/** Fields whose URLs are our own S3 uploads (urlPembelian are external links). */
const STORED_FIELDS: ReadonlySet<AdminMediaField> = new Set([
  'fotoKegiatan',
  'videoKegiatan',
  'dokumenKurikulum',
  'fotoAlat',
]);

/** Statuses an admin can move back to REVISI. */
export const MOVABLE_TO_REVISI: readonly PROTStatus[] = [
  PROTStatus.ARSIP_NASIONAL,
  PROTStatus.DIVERIFIKASI,
];

export interface AdminMediaRemovalResult {
  protId: string;
  field: AdminMediaField;
  status: PROTStatus;
  /** False when the URL was not (or no longer) in the field: nothing changed (idempotent repeat). */
  removed: boolean;
  removedCount: number;
  /** True when the S3 object was deleted; false when not attempted or when the delete failed (logged). */
  s3Deleted: boolean;
}

export interface AdminMoveToRevisiResult {
  protId: string;
  from: PROTStatus;
  status: PROTStatus;
  /** False when the record already was in REVISI (idempotent repeat). */
  changed: boolean;
}

/**
 * Removes every occurrence of `url` from one media field of a record (pure; mutates `prot`).
 * fotoAlat / urlPembelian: in `peralatanIndex` only, or in every equipment item when it is undefined.
 */
export function removeUrlFromRecord(
  prot: PROT,
  field: AdminMediaField,
  url: string,
  peralatanIndex?: number,
): number {
  const strip = (list: unknown): { list: string[]; count: number } => {
    const arr = Array.isArray(list) ? (list as unknown[]) : [];
    const kept = arr.filter((u) => u !== url) as string[];
    return { list: kept, count: arr.length - kept.length };
  };

  if (field === 'fotoAlat' || field === 'urlPembelian') {
    const items = Array.isArray(prot.peralatan) ? prot.peralatan : [];
    if (
      peralatanIndex !== undefined &&
      (peralatanIndex < 0 || peralatanIndex >= items.length)
    ) {
      throw new BadRequestException(
        `Invalid peralatan index: ${peralatanIndex}`,
      );
    }
    let count = 0;
    items.forEach((item, i) => {
      if (peralatanIndex !== undefined && i !== peralatanIndex) return;
      const current = item?.[field];
      if (current === undefined || current === null) return;
      const res = strip(current);
      if (res.count > 0) {
        item[field] = res.list;
        count += res.count;
      }
    });
    return count;
  }

  const res = strip(prot[field]);
  if (res.count > 0) prot[field] = res.list;
  return res.count;
}

/** True when `url` still appears in any media field of the record (then its S3 object must stay). */
export function recordReferencesUrl(prot: PROT, url: string): boolean {
  const lists: unknown[] = [
    prot.fotoKegiatan,
    prot.videoKegiatan,
    prot.dokumenKurikulum,
    ...(Array.isArray(prot.peralatan)
      ? prot.peralatan.flatMap((p) => [p?.fotoAlat, p?.urlPembelian])
      : []),
  ];
  return lists.some((l) => Array.isArray(l) && l.includes(url));
}

/** Only PROT uploads on S3 are ever deleted (keys under prot/). */
export function isOwnProtUpload(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.amazonaws.com') &&
      u.pathname.startsWith('/prot/')
    );
  } catch {
    return false;
  }
}

/**
 * Admin-only corrections of records in ANY status (Phase 25, privacy hotfix). The contributor rules
 * (`PROTService.assertCanEditMedia()`: owner or admin, DRAFT / REVISI only) are unchanged.
 */
@Injectable()
export class ProtAdminService {
  private readonly logger = new Logger(ProtAdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  /** One audit_logs row, in the caller's transaction. */
  private async writeAudit(
    manager: EntityManager,
    entry: Pick<
      AuditLog,
      'user_id' | 'action' | 'entity_type' | 'entity_id' | 'changes'
    >,
  ): Promise<void> {
    const repo = manager.getRepository(AuditLog);
    await repo.save(repo.create(entry));
  }

  private async lockProt(manager: EntityManager, protId: string) {
    const prot = await manager.getRepository(PROT).findOne({
      where: { id: protId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!prot) throw new NotFoundException('PROT tidak ditemukan');
    return prot;
  }

  /**
   * Removes one media item (every occurrence of the URL in that field) from a record in any status.
   * One transaction: row lock, save, audit row. The S3 object is deleted after the commit, only when it is
   * one of our PROT uploads and nothing in the record points to it any more. A repeated call changes nothing.
   */
  async removeMedia(
    protId: string,
    admin: ActingAdmin,
    dto: AdminRemoveMediaDto,
  ): Promise<AdminMediaRemovalResult> {
    const { field, url, peralatanIndex, reason } = dto;
    const outcome = await this.dataSource.transaction(async (manager) => {
      const prot = await this.lockProt(manager, protId);
      const removedCount = removeUrlFromRecord(
        prot,
        field,
        url,
        peralatanIndex,
      );
      if (removedCount > 0) await manager.getRepository(PROT).save(prot);
      const deleteObject =
        removedCount > 0 &&
        STORED_FIELDS.has(field) &&
        isOwnProtUpload(url) &&
        !recordReferencesUrl(prot, url);
      await this.writeAudit(manager, {
        user_id: admin.id,
        action: AUDIT_ADMIN_MEDIA_REMOVE,
        entity_type: 'prot',
        entity_id: protId,
        // Who, which record and field, which URL and why. Never the file contents.
        changes: {
          field,
          url,
          peralatanIndex: peralatanIndex ?? null,
          removedCount,
          status: prot.status,
          deleteObject,
          reason,
        },
      });
      return { removedCount, deleteObject, status: prot.status };
    });

    let s3Deleted = false;
    if (outcome.deleteObject) {
      try {
        await this.storageService.deleteFile(url);
        s3Deleted = true;
      } catch (error) {
        const name = error instanceof Error ? error.name : 'UnknownError';
        this.logger.warn(
          `Admin media removal: S3 delete failed for PROT ${protId} ${field} (${name}); the object may remain.`,
        );
      }
    }

    return {
      protId,
      field,
      status: outcome.status,
      removed: outcome.removedCount > 0,
      removedCount: outcome.removedCount,
      s3Deleted,
    };
  }

  /**
   * Moves a published (or verified) record back to REVISI, so it disappears from every public list and its
   * owner can correct it with the normal edit routes. Audited. Already REVISI = no change.
   */
  async moveToRevisi(
    protId: string,
    admin: ActingAdmin,
    dto: AdminMoveToRevisiDto,
  ): Promise<AdminMoveToRevisiResult> {
    return this.dataSource.transaction(async (manager) => {
      const prot = await this.lockProt(manager, protId);
      const from = prot.status;
      if (from === PROTStatus.REVISI) {
        return { protId, from, status: from, changed: false };
      }
      if (!MOVABLE_TO_REVISI.includes(from)) {
        throw new BadRequestException(
          `PROT dengan status ${from} tidak bisa dikembalikan ke REVISI oleh admin`,
        );
      }
      await manager
        .getRepository(PROT)
        .update({ id: protId }, { status: PROTStatus.REVISI });
      await this.writeAudit(manager, {
        user_id: admin.id,
        action: AUDIT_ADMIN_MOVE_TO_REVISI,
        entity_type: 'prot',
        entity_id: protId,
        changes: { from, to: PROTStatus.REVISI, reason: dto.reason },
      });
      return { protId, from, status: PROTStatus.REVISI, changed: true };
    });
  }
}
