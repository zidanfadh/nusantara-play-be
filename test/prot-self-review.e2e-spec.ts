/**
 * Phase 26: no self-review (pick, review, publish), admin override with an audited reason, the resubmit note, and the
 * form fields deskripsi / jumlahPemain. Full AppModule against the local test database.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PROT,
  PROTJenis,
  PROTStatus,
  TargetUsia,
} from '../src/modules/prot/entities/prot.entity';
import { VerifikasiQueue } from '../src/modules/prot/entities/verifikasi-queue.entity';
import { AUDIT_SELF_REVIEW_OVERRIDE } from '../src/modules/prot/self-review';
import { createE2eApp } from './e2e-app';

const PASSWORD = 'correct horse battery';

describe('PROT self-review rule (e2e, Phase 26)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const emails: string[] = [];
  const protIds: string[] = [];
  let ipCounter = 0;
  let admin: { token: string; userId: string };
  let pakar: { token: string; userId: string };

  const server = () => app.getHttpServer();
  const freshIp = () => `10.26.0.${(ipCounter++ % 250) + 1}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(label: string, role: string) {
    const email = `e2e-selfreview-${label}-${randomUUID().slice(0, 8)}@example.test`;
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

  async function insertProt(status: PROTStatus, createdBy: string) {
    const prot = await dataSource.getRepository(PROT).save({
      nama: `E2E SELF REVIEW ${randomUUID().slice(0, 8)}`,
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.SEMUA_USIA,
      status,
      created_by: createdBy,
    });
    protIds.push(prot.id);
    return prot;
  }

  const queueOf = (protId: string) =>
    dataSource.getRepository(VerifikasiQueue).findOne({
      where: { prot_id: protId },
    });
  const overrideRows = (protId: string) =>
    dataSource.query<{ user_id: string; changes: Record<string, unknown> }[]>(
      'SELECT user_id, changes FROM audit_logs WHERE entity_id = $1 AND action = $2 ORDER BY created_at',
      [protId, AUDIT_SELF_REVIEW_OVERRIDE],
    );

  beforeAll(async () => {
    ({ app } = await createE2eApp());
    dataSource = app.get(DataSource);
    admin = await login('admin', 'admin_kpoti');
    pakar = await login('pakar', 'pakar');
  });

  afterAll(async () => {
    if (protIds.length) {
      await dataSource.query(
        'DELETE FROM audit_logs WHERE entity_id = ANY($1)',
        [protIds],
      );
      await dataSource.query('DELETE FROM verifikasi WHERE prot_id = ANY($1)', [
        protIds,
      ]);
      await dataSource.query(
        'DELETE FROM verifikasi_queue WHERE prot_id = ANY($1)',
        [protIds],
      );
      await dataSource.query('DELETE FROM prot WHERE id = ANY($1)', [protIds]);
    }
    for (const email of emails) {
      await dataSource.query(
        'DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
        [email],
      );
      await dataSource.query('DELETE FROM users WHERE email = $1', [email]);
    }
    await app.close();
  });

  it('create and update accept deskripsi and jumlahPemain; an unknown key such as kecamatanName fails the request', async () => {
    const created = await request(server())
      .post('/api/prot')
      .set(auth(admin.token))
      .send({
        nama: 'E2E Form Fields',
        jenis: PROTJenis.PERMAINAN_RAKYAT,
        targetUsia: TargetUsia.ANAK,
        deskripsi: 'Ringkasan singkat',
        jumlahPemain: 4,
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    protIds.push(id);
    expect(created.body).toMatchObject({
      deskripsi: 'Ringkasan singkat',
      jumlahPemain: 4,
    });

    await request(server())
      .patch(`/api/prot/${id}`)
      .set(auth(admin.token))
      .send({ jumlahPemain: null, deskripsi: '' })
      .expect(200);
    const row = await dataSource.getRepository(PROT).findOneByOrFail({ id });
    expect(row.jumlahPemain).toBeNull();
    expect(row.deskripsi).toBe('');

    await request(server())
      .patch(`/api/prot/${id}`)
      .set(auth(admin.token))
      .send({ nama: 'E2E Form Fields', kecamatanName: 'X' })
      .expect(400);
    await request(server())
      .patch(`/api/prot/${id}`)
      .set(auth(admin.token))
      .send({ jumlahPemain: 0 })
      .expect(400);
  });

  it('a pakar cannot claim a record they created', async () => {
    const prot = await insertProt(PROTStatus.DIKURASI, pakar.userId);
    const queue = await dataSource
      .getRepository(VerifikasiQueue)
      .save({ prot_id: prot.id, priority: 0 });
    await request(server())
      .post(`/api/verifikasi/queue/${queue.id}/pick`)
      .set(auth(pakar.token))
      .expect(403);
    expect((await queueOf(prot.id))?.assigned_pakar_id).toBeNull();
  });

  it('an admin reviews and publishes their own record only with an audited reason', async () => {
    const prot = await insertProt(PROTStatus.DRAFT, admin.userId);

    await request(server())
      .post(`/api/prot/${prot.id}/submit-kurasi`)
      .set(auth(admin.token))
      .send({ catatan: 'Catatan kontributor' })
      .expect(201);
    const queue = await queueOf(prot.id);
    expect(queue?.catatan_kurator).toBe('Catatan kontributor');

    await request(server())
      .post(`/api/verifikasi/queue/${queue!.id}/pick`)
      .set(auth(admin.token))
      .expect(201);

    await request(server())
      .post(`/api/verifikasi/${prot.id}/review`)
      .set(auth(admin.token))
      .send({ status: 'APPROVED' })
      .expect(403);
    await request(server())
      .post(`/api/verifikasi/${prot.id}/review`)
      .set(auth(admin.token))
      .send({ status: 'APPROVED', selfReviewOverrideReason: 'pendek' })
      .expect(400);
    expect(await overrideRows(prot.id)).toHaveLength(0);

    await request(server())
      .post(`/api/verifikasi/${prot.id}/review`)
      .set(auth(admin.token))
      .send({
        status: 'APPROVED',
        selfReviewOverrideReason: 'Satu-satunya pemeriksa yang tersedia',
      })
      .expect(201);

    await request(server())
      .post(`/api/verifikasi/prot/${prot.id}/publish`)
      .set(auth(admin.token))
      .send({ catatan: 'x' })
      .expect(403);
    await request(server())
      .post(`/api/verifikasi/prot/${prot.id}/publish`)
      .set(auth(admin.token))
      .send({
        catatan: 'x',
        selfReviewOverrideReason: 'Tidak ada admin lain hari ini',
      })
      .expect(201);

    const row = await dataSource
      .getRepository(PROT)
      .findOneByOrFail({ id: prot.id });
    expect(row.status).toBe(PROTStatus.ARSIP_NASIONAL);
    const rows = await overrideRows(prot.id);
    expect(
      rows.map((r) => [r.user_id, r.changes.step, r.changes.reason]),
    ).toEqual([
      [admin.userId, 'review', 'Satu-satunya pemeriksa yang tersedia'],
      [admin.userId, 'publish', 'Tidak ada admin lain hari ini'],
    ]);
  });

  it('another reviewer is unaffected; resubmit takes an optional note', async () => {
    const prot = await insertProt(PROTStatus.REVISI, admin.userId);
    await request(server())
      .post(`/api/prot/${prot.id}/resubmit`)
      .set(auth(admin.token))
      .send({ catatan: '  Foto pertama diganti ' })
      .expect(201);
    const queue = await queueOf(prot.id);
    expect(queue?.catatan_kurator).toBe('Foto pertama diganti');

    await request(server())
      .post(`/api/verifikasi/queue/${queue!.id}/pick`)
      .set(auth(pakar.token))
      .expect(201);
    await request(server())
      .post(`/api/verifikasi/${prot.id}/review`)
      .set(auth(pakar.token))
      .send({ status: 'REVISION_NEEDED', saran_perbaikan: 'Lengkapi teks' })
      .expect(201);
    expect(await overrideRows(prot.id)).toHaveLength(0);

    // The old frontend sends no body: still works.
    await request(server())
      .post(`/api/prot/${prot.id}/resubmit`)
      .set(auth(admin.token))
      .expect(201);
    expect((await queueOf(prot.id))?.catatan_kurator).toBeNull();
  });
});
