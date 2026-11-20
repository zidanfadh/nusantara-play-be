/**
 * Phase 25 admin corrections of PROT in any status, full AppModule against the local test database.
 * StorageService.deleteFile is spied on (no S3 call ever leaves the test).
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DEMO_IDS } from '../src/scripts/db-local-setup';
import {
  PROT,
  PROTJenis,
  PROTStatus,
  TargetUsia,
} from '../src/modules/prot/entities/prot.entity';
import { StorageService } from '../src/modules/storage/storage.service';
import { createE2eApp } from './e2e-app';

const PASSWORD = 'correct horse battery';
const S3 = 'https://nusantara-play-storage.s3.ap-southeast-2.amazonaws.com';
const PDF = `${S3}/prot/dokumen-kurikulum/${randomUUID()}.pdf`;
const PHOTO = `${S3}/prot/foto-kegiatan/${randomUUID()}.png`;
const TROPHY = `${S3}/prot/peralatan/${randomUUID()}.png`;
const CAKE = 'https://shop.example/cake-product';

describe('Admin PROT corrections (e2e, Phase 25)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let deleteFile: jest.SpyInstance;
  const emails: string[] = [];
  let protId: string;
  let adminToken: string;
  let adminId: string;
  let kuratorToken: string;
  let ipCounter = 0;

  const server = () => app.getHttpServer();
  const freshIp = () => `10.25.0.${(ipCounter++ % 250) + 1}`;

  async function login(
    label: string,
    role: string,
  ): Promise<{ token: string; userId: string }> {
    const email = `e2e-adminprot-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(email);
    const ip = freshIp();
    await request(server())
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD, full_name: `E2E ${label}` })
      .expect(201);
    const res = await request(server())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = res.body as { accessToken: string; user: { id: string } };
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', [
      role,
      body.user.id,
    ]);
    return { token: body.accessToken, userId: body.user.id };
  }

  const removeMedia = (token: string | null, id: string, body: object) => {
    const req = request(server()).post(`/api/admin/prot/${id}/media/remove`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  };
  const toRevisi = (token: string | null, id: string, body: object) => {
    const req = request(server()).post(`/api/admin/prot/${id}/revisi`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  };
  const auditRows = (action: string) =>
    dataSource.query<
      {
        user_id: string;
        entity_type: string;
        changes: Record<string, unknown>;
      }[]
    >(
      'SELECT user_id, entity_type, changes FROM audit_logs WHERE entity_id = $1 AND action = $2 ORDER BY created_at',
      [protId, action],
    );

  beforeAll(async () => {
    ({ app } = await createE2eApp());
    dataSource = app.get(DataSource);
    deleteFile = jest
      .spyOn(app.get(StorageService), 'deleteFile')
      .mockResolvedValue(undefined);
    const prot = await dataSource.getRepository(PROT).save({
      nama: `E2E PUBLISHED PROT ${randomUUID().slice(0, 8)}`,
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.SEMUA_USIA,
      status: PROTStatus.ARSIP_NASIONAL,
      provinsiKode: '11',
      created_by: DEMO_IDS.user,
      fotoKegiatan: [PHOTO],
      dokumenKurikulum: [PDF],
      peralatan: [
        {
          nama: 'Biji Pinang',
          fotoAlat: [TROPHY],
          urlPembelian: [CAKE],
        },
      ],
    });
    protId = prot.id;
    ({ token: adminToken, userId: adminId } = await login(
      'admin',
      'admin_kpoti',
    ));
    ({ token: kuratorToken } = await login('kurator', 'kurator_daerah'));
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM audit_logs WHERE entity_id = $1', [
      protId,
    ]);
    await dataSource.query('DELETE FROM prot WHERE id = $1', [protId]);
    await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
    await app.close();
  });

  it('401 without a token, 403 for kurator_daerah, 400 for invalid bodies and ids', async () => {
    const body = {
      field: 'dokumenKurikulum',
      url: PDF,
      reason: 'Data pribadi',
    };
    await removeMedia(null, protId, body).expect(401);
    await toRevisi(null, protId, { reason: 'Data pribadi' }).expect(401);
    await removeMedia(kuratorToken, protId, body).expect(403);
    await toRevisi(kuratorToken, protId, { reason: 'Data pribadi' }).expect(
      403,
    );
    await removeMedia(adminToken, protId, { ...body, field: 'nama' }).expect(
      400,
    );
    await removeMedia(adminToken, protId, { ...body, reason: 'x' }).expect(400);
    await removeMedia(adminToken, protId, { ...body, url: 'not a url' }).expect(
      400,
    );
    await removeMedia(adminToken, 'not-a-uuid', body).expect(400);
    await removeMedia(adminToken, randomUUID(), body).expect(404);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('the contributor media routes still refuse a published record (DRAFT/REVISI rule unchanged)', async () => {
    await request(server())
      .delete(`/api/prot/${protId}/dokumen-kurikulum/0`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('admin removes the document of a PUBLISHED record: DB, S3, audit; a repeat changes nothing', async () => {
    const res = await removeMedia(adminToken, protId, {
      field: 'dokumenKurikulum',
      url: PDF,
      reason: 'Dokumen berisi data pribadi (Phase 24)',
    }).expect(200);
    expect(res.body).toEqual({
      protId,
      field: 'dokumenKurikulum',
      status: 'ARSIP_NASIONAL',
      removed: true,
      removedCount: 1,
      s3Deleted: true,
    });
    expect(deleteFile).toHaveBeenCalledWith(PDF);

    const pub = await request(server()).get(`/api/prot/${protId}`).expect(200);
    expect((pub.body as PROT).dokumenKurikulum).toEqual([]);
    expect((pub.body as PROT).status).toBe('ARSIP_NASIONAL');

    deleteFile.mockClear();
    const again = await removeMedia(adminToken, protId, {
      field: 'dokumenKurikulum',
      url: PDF,
      reason: 'Dokumen berisi data pribadi (Phase 24)',
    }).expect(200);
    expect(again.body).toMatchObject({ removed: false, s3Deleted: false });
    expect(deleteFile).not.toHaveBeenCalled();

    const rows = await auditRows('ADMIN_PROT_MEDIA_REMOVE');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: adminId,
      entity_type: 'prot',
      changes: {
        field: 'dokumenKurikulum',
        url: PDF,
        removedCount: 1,
        deleteObject: true,
        reason: 'Dokumen berisi data pribadi (Phase 24)',
      },
    });
    expect(rows[1].changes).toMatchObject({
      removedCount: 0,
      deleteObject: false,
    });
  });

  it('admin removes an equipment photo and a purchase link (no S3 call for the link)', async () => {
    deleteFile.mockClear();
    await removeMedia(adminToken, protId, {
      field: 'fotoAlat',
      url: TROPHY,
      peralatanIndex: 0,
      reason: 'Foto trofi, bukan alat',
    }).expect(200);
    expect(deleteFile).toHaveBeenCalledWith(TROPHY);
    deleteFile.mockClear();
    await removeMedia(adminToken, protId, {
      field: 'urlPembelian',
      url: CAKE,
      reason: 'Tautan produk kue',
    }).expect(200);
    expect(deleteFile).not.toHaveBeenCalled();
    const saved = await dataSource
      .getRepository(PROT)
      .findOneByOrFail({ id: protId });
    expect(saved.peralatan[0].fotoAlat).toEqual([]);
    expect(saved.peralatan[0].urlPembelian).toEqual([]);
    expect(saved.fotoKegiatan).toEqual([PHOTO]);
  });

  it('admin moves the published record back to REVISI: hidden from the public, audited, idempotent', async () => {
    const res = await toRevisi(adminToken, protId, {
      reason: 'Perlu dikoreksi kurator',
    }).expect(200);
    expect(res.body).toEqual({
      protId,
      from: 'ARSIP_NASIONAL',
      status: 'REVISI',
      changed: true,
    });
    await request(server()).get(`/api/prot/${protId}`).expect(404);
    const list = await request(server())
      .get('/api/prot?status=ARSIP_NASIONAL&limit=100')
      .expect(200);
    expect((list.body as { data: PROT[] }).data.map((p) => p.id)).not.toContain(
      protId,
    );

    const again = await toRevisi(adminToken, protId, {
      reason: 'Perlu dikoreksi kurator',
    }).expect(200);
    expect(again.body).toMatchObject({ changed: false, status: 'REVISI' });

    const rows = await auditRows('ADMIN_PROT_MOVE_TO_REVISI');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: adminId,
      changes: { from: 'ARSIP_NASIONAL', to: 'REVISI' },
    });

    // In REVISI the normal routes work again (owner or admin).
    await request(server())
      .delete(`/api/prot/${protId}/foto-kegiatan/0`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
