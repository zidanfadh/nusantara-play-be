import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PROT, PROTStatus } from './entities/prot.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { StorageService } from '../storage/storage.service';
import {
  AUDIT_ADMIN_MEDIA_REMOVE,
  AUDIT_ADMIN_MOVE_TO_REVISI,
  isOwnProtUpload,
  ProtAdminService,
  recordReferencesUrl,
  removeUrlFromRecord,
} from './prot-admin.service';
import { ADMIN_MEDIA_FIELDS } from './dto/admin-prot.dto';

const S3 = 'https://nusantara-play-storage.s3.ap-southeast-2.amazonaws.com';
const PDF = `${S3}/prot/dokumen-kurikulum/aaaa.pdf`;
const PHOTO = `${S3}/prot/foto-kegiatan/bbbb.png`;
const TROPHY = `${S3}/prot/peralatan/cccc.png`;
const CAKE = 'https://shop.example/cake';
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad' };
const PROT_ID = '00000000-0000-4000-8000-000000000001';

function record(status = PROTStatus.ARSIP_NASIONAL): PROT {
  return {
    id: PROT_ID,
    status,
    fotoKegiatan: [PHOTO],
    videoKegiatan: null,
    dokumenKurikulum: [PDF],
    peralatan: [
      { nama: 'Lapangan', fotoAlat: [] },
      { nama: 'Biji Pinang', fotoAlat: [TROPHY], urlPembelian: [CAKE] },
    ],
  } as unknown as PROT;
}

describe('ProtAdminService (Phase 25)', () => {
  let current: PROT | null;
  const protRepo = {
    findOne: jest.fn(() => Promise.resolve(current)),
    save: jest.fn((p: PROT) => Promise.resolve(p)),
    update: jest.fn(() => Promise.resolve({})),
  };
  const auditRepo = {
    create: jest.fn((e: unknown) => e),
    save: jest.fn(() => Promise.resolve({})),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === AuditLog ? auditRepo : protRepo,
    ),
  };
  const dataSource = {
    transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
  } as unknown as DataSource;
  const storage = { deleteFile: jest.fn(() => Promise.resolve()) };
  let service: ProtAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    current = record();
    service = new ProtAdminService(
      dataSource,
      storage as unknown as StorageService,
    );
  });

  describe('removeMedia', () => {
    it('removes a document from a PUBLISHED record, saves, audits, then deletes the S3 object', async () => {
      const order: string[] = [];
      protRepo.save.mockImplementationOnce((p: PROT) => {
        order.push('save');
        return Promise.resolve(p);
      });
      auditRepo.save.mockImplementationOnce(() => {
        order.push('audit');
        return Promise.resolve({});
      });
      storage.deleteFile.mockImplementationOnce(() => {
        order.push('s3');
        return Promise.resolve();
      });

      const res = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'dokumenKurikulum',
        url: PDF,
        reason: 'Data pribadi (Phase 24)',
      });

      expect(res).toEqual({
        protId: PROT_ID,
        field: 'dokumenKurikulum',
        status: PROTStatus.ARSIP_NASIONAL,
        removed: true,
        removedCount: 1,
        s3Deleted: true,
      });
      expect(order).toEqual(['save', 'audit', 's3']);
      expect(protRepo.findOne).toHaveBeenCalledWith({
        where: { id: PROT_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(current!.dokumenKurikulum).toEqual([]);
      expect(current!.status).toBe(PROTStatus.ARSIP_NASIONAL); // status untouched
      expect(storage.deleteFile).toHaveBeenCalledWith(PDF);
      expect(auditRepo.save).toHaveBeenCalledWith({
        user_id: ADMIN.id,
        action: AUDIT_ADMIN_MEDIA_REMOVE,
        entity_type: 'prot',
        entity_id: PROT_ID,
        changes: {
          field: 'dokumenKurikulum',
          url: PDF,
          peralatanIndex: null,
          removedCount: 1,
          status: PROTStatus.ARSIP_NASIONAL,
          deleteObject: true,
          reason: 'Data pribadi (Phase 24)',
        },
      });
    });

    it('is idempotent: a repeat finds nothing, saves nothing, deletes nothing, still audits', async () => {
      await service.removeMedia(PROT_ID, ADMIN, {
        field: 'dokumenKurikulum',
        url: PDF,
        reason: 'first time',
      });
      jest.clearAllMocks();
      const again = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'dokumenKurikulum',
        url: PDF,
        reason: 'second time',
      });
      expect(again.removed).toBe(false);
      expect(again.removedCount).toBe(0);
      expect(again.s3Deleted).toBe(false);
      expect(protRepo.save).not.toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalledTimes(1);
    });

    it('removes an equipment photo (S3) and a purchase link (no S3 call)', async () => {
      const photo = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'fotoAlat',
        url: TROPHY,
        peralatanIndex: 1,
        reason: 'trophy, not the equipment',
      });
      expect(photo.s3Deleted).toBe(true);
      expect(current!.peralatan[1].fotoAlat).toEqual([]);

      storage.deleteFile.mockClear();
      const link = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'urlPembelian',
        url: CAKE,
        reason: 'cake product link',
      });
      expect(link).toMatchObject({ removed: true, s3Deleted: false });
      expect(current!.peralatan[1].urlPembelian).toEqual([]);
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it('keeps the S3 object while another field of the record still uses the URL', async () => {
      current!.fotoKegiatan = [PHOTO, PDF];
      const res = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'dokumenKurikulum',
        url: PDF,
        reason: 'shared url',
      });
      expect(res).toMatchObject({ removed: true, s3Deleted: false });
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it('a failed S3 delete is logged and reported, the DB change stays', async () => {
      storage.deleteFile.mockRejectedValueOnce(
        Object.assign(new Error('x'), { name: 'AccessDenied' }),
      );
      const res = await service.removeMedia(PROT_ID, ADMIN, {
        field: 'fotoKegiatan',
        url: PHOTO,
        reason: 'children faces',
      });
      expect(res).toMatchObject({ removed: true, s3Deleted: false });
      expect(current!.fotoKegiatan).toEqual([]);
    });

    it('404 for an unknown record, 400 for a bad equipment index', async () => {
      current = null;
      await expect(
        service.removeMedia(PROT_ID, ADMIN, {
          field: 'fotoKegiatan',
          url: PHOTO,
          reason: 'x reason',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      current = record();
      await expect(
        service.removeMedia(PROT_ID, ADMIN, {
          field: 'fotoAlat',
          url: TROPHY,
          peralatanIndex: 5,
          reason: 'x reason',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('works in every status (DRAFT to ARSIP_NASIONAL)', async () => {
      for (const status of Object.values(PROTStatus)) {
        current = record(status);
        const res = await service.removeMedia(PROT_ID, ADMIN, {
          field: 'fotoKegiatan',
          url: PHOTO,
          reason: 'any status',
        });
        expect(res.removed).toBe(true);
      }
    });
  });

  describe('moveToRevisi', () => {
    it.each([PROTStatus.ARSIP_NASIONAL, PROTStatus.DIVERIFIKASI])(
      'moves %s to REVISI and audits',
      async (from) => {
        current = record(from);
        const res = await service.moveToRevisi(PROT_ID, ADMIN, {
          reason: 'PDF dengan data pribadi',
        });
        expect(res).toEqual({
          protId: PROT_ID,
          from,
          status: PROTStatus.REVISI,
          changed: true,
        });
        expect(protRepo.update).toHaveBeenCalledWith(
          { id: PROT_ID },
          { status: PROTStatus.REVISI },
        );
        expect(auditRepo.save).toHaveBeenCalledWith({
          user_id: ADMIN.id,
          action: AUDIT_ADMIN_MOVE_TO_REVISI,
          entity_type: 'prot',
          entity_id: PROT_ID,
          changes: {
            from,
            to: PROTStatus.REVISI,
            reason: 'PDF dengan data pribadi',
          },
        });
      },
    );

    it('already REVISI: no change, no audit (idempotent)', async () => {
      current = record(PROTStatus.REVISI);
      const res = await service.moveToRevisi(PROT_ID, ADMIN, {
        reason: 'again',
      });
      expect(res.changed).toBe(false);
      expect(protRepo.update).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it.each([PROTStatus.DRAFT, PROTStatus.DIKURASI])(
      'refuses %s (400)',
      async (from) => {
        current = record(from);
        await expect(
          service.moveToRevisi(PROT_ID, ADMIN, { reason: 'nope nope' }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe('pure helpers', () => {
    it('removeUrlFromRecord handles every field and missing lists', () => {
      for (const field of ADMIN_MEDIA_FIELDS) {
        expect(() =>
          removeUrlFromRecord(record(), field, 'https://none.example/x'),
        ).not.toThrow();
      }
      const p = record();
      p.dokumenKurikulum = [PDF, PDF];
      expect(removeUrlFromRecord(p, 'dokumenKurikulum', PDF)).toBe(2);
      expect(removeUrlFromRecord(p, 'videoKegiatan', PDF)).toBe(0);
      expect(removeUrlFromRecord(record(), 'fotoAlat', TROPHY, 0)).toBe(0);
      expect(removeUrlFromRecord(record(), 'fotoAlat', TROPHY)).toBe(1);
    });

    it('recordReferencesUrl and isOwnProtUpload', () => {
      expect(recordReferencesUrl(record(), CAKE)).toBe(true);
      expect(recordReferencesUrl(record(), 'https://x.example/y')).toBe(false);
      expect(isOwnProtUpload(PDF)).toBe(true);
      expect(isOwnProtUpload(`${S3}/nft/x.png`)).toBe(false);
      expect(isOwnProtUpload(CAKE)).toBe(false);
      expect(isOwnProtUpload('nope')).toBe(false);
    });
  });
});
