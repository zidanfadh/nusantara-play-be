/**
 * Phase 15 rewards endpoints, full AppModule against the local test database
 * (createE2eApp: same setup as main.ts, test keys from test/test-env.ts).
 * Users register and log in through the real self-hosted endpoints.
 *
 * Uses the DEMO Sumatera Selatan PROT (provinsi 16, 4 x ARSIP_NASIONAL,
 * seeded by db:setup), so the Paspor stamp comes with the third view.
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
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import type {
  LeaderboardView,
  LedgerItem,
  Paginated,
  PasporView,
} from '../src/modules/rewards/rewards-query.service';
import { createE2eApp } from './e2e-app';

const PASSWORD = 'correct horse battery';
const PUBLIC_USER_KEYS = ['avatar_url', 'full_name', 'id', 'institution'];
const SUMSEL = '16';

/** Every key anywhere in a JSON body. */
function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

describe('Rewards endpoints (e2e, Phase 15)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const emails: string[] = [];
  let draftProtId: string;
  let ipCounter = 0;

  const server = () => app.getHttpServer();
  const freshIp = () =>
    `10.15.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

  /** Registers and logs in through /api/auth; returns token and user id. */
  async function login(
    label: string,
  ): Promise<{ token: string; userId: string }> {
    const email = `e2e-rewards-${label}-${randomUUID().slice(0, 8)}@example.test`;
    emails.push(email);
    const ip = freshIp();
    await request(server())
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD, full_name: `E2E Rewards ${label}` })
      .expect(201);
    const res = await request(server())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = res.body as { accessToken: string; user: { id: string } };
    // Private fields that must never appear on the leaderboard.
    await dataSource.query('UPDATE users SET phone = $1 WHERE id = $2', [
      '+62 800 1111 2222',
      body.user.id,
    ]);
    return { token: body.accessToken, userId: body.user.id };
  }

  const activity = (token: string, type: unknown, refId: unknown) =>
    request(server())
      .post('/api/rewards/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ type, refId });
  const get = (token: string, path: string) =>
    request(server())
      .get(`/api/rewards/${path}`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app } = await createE2eApp());
    dataSource = app.get(DataSource);
    const draft = await dataSource.getRepository(PROT).save({
      nama: `E2E DRAFT PROT ${randomUUID().slice(0, 8)}`,
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.SEMUA_USIA,
      status: PROTStatus.DRAFT,
      provinsiKode: SUMSEL,
      created_by: DEMO_IDS.user,
    });
    draftProtId = draft.id;
  });

  afterAll(async () => {
    // Cascades into reward_ledger (allowed by the trigger), balances, views, stamps.
    await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
    await dataSource.query('DELETE FROM prot WHERE id = $1', [draftProtId]);
    await app.close();
  });

  it('401 without a token on every rewards endpoint', async () => {
    await request(server())
      .post('/api/rewards/activities')
      .send({ type: 'PROVINCE_ENTER', refId: SUMSEL })
      .expect(401);
    for (const path of ['me', 'me/ledger', 'me/paspor', 'leaderboard']) {
      await request(server()).get(`/api/rewards/${path}`).expect(401);
    }
    await request(server())
      .post('/api/admin/rewards/adjust')
      .send({})
      .expect(401);
  });

  it('full walk: enter Sumatera Selatan, view the 4 DEMO PROT, /me, ledger, paspor, leaderboard', async () => {
    const { token, userId } = await login('walk');

    const enter = await activity(token, 'PROVINCE_ENTER', SUMSEL).expect(200);
    expect(enter.body).toMatchObject({
      granted: { xp: 25, points: 0 },
      balance: { xp: 25, points: 0, pointsAvailable: 0 },
      level: 1,
      levelUp: false,
      stamp: null,
      duplicate: false,
    });
    const again = await activity(token, 'PROVINCE_ENTER', SUMSEL).expect(200);
    expect(again.body).toMatchObject({ granted: { xp: 0 }, duplicate: true });

    const views: request.Response[] = [];
    for (const id of DEMO_IDS.protSumsel) {
      views.push(await activity(token, 'PROT_VIEW', id).expect(200));
    }
    expect(
      views.map((v) => (v.body as { granted: { xp: number } }).granted.xp),
    ).toEqual([10, 10, 60, 10]);
    expect(views[2].body).toMatchObject({
      stamp: { provinsiKode: SUMSEL, xp: 50 },
      balance: { xp: 105 },
      level: 2,
      levelUp: true,
    });

    const me = await get(token, 'me').expect(200);
    expect(me.body).toEqual({
      xp: 115,
      level: 2,
      xpForCurrentLevel: 100,
      xpForNextLevel: 300,
      pointsTotal: 0,
      pointsAvailable: 0,
      pointsOnHold: 0,
    });

    const page1 = await get(token, 'me/ledger?page=1&limit=2').expect(200);
    expect((page1.body as Paginated<LedgerItem>).pagination).toEqual({
      total: 6,
      page: 1,
      limit: 2,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
    // Newest first: the 4th view, then the stamp (inserted after the 3rd view).
    expect(
      (page1.body as Paginated<LedgerItem>).data.map((r) => [
        r.rule_code,
        r.source_id,
      ]),
    ).toEqual([
      ['PROT_VIEW', DEMO_IDS.protSumsel[3]],
      ['PASPOR_STAMP', SUMSEL],
    ]);
    const all = await get(token, 'me/ledger?limit=50').expect(200);
    expect(
      (all.body as Paginated<LedgerItem>).data.map((r) => r.rule_code),
    ).toEqual([
      'PROT_VIEW',
      'PASPOR_STAMP',
      'PROT_VIEW',
      'PROT_VIEW',
      'PROT_VIEW',
      'PROVINCE_ENTER',
    ]);
    await get(token, 'me/ledger?limit=51').expect(400);

    const paspor = await get(token, 'me/paspor').expect(200);
    expect(paspor.body).toMatchObject({
      total_provinces: 34,
      stamped_count: 1,
    });
    const sumsel = (paspor.body as PasporView).provinces.find(
      (p) => p.provinsi_kode === SUMSEL,
    );
    expect(sumsel).toMatchObject({
      nama: expect.any(String) as string,
      stamped: true,
      stamped_at: expect.any(String) as string,
      prot_viewed: 4,
      prot_count: 4,
    });
    const jabar = (paspor.body as PasporView).provinces.find(
      (p) => p.provinsi_kode === '32',
    );
    expect(jabar).toMatchObject({
      stamped: false,
      stamped_at: null,
      prot_viewed: 0,
    });

    const national = await get(token, 'leaderboard').expect(200);
    const board = national.body as LeaderboardView;
    expect(board.scope).toBe('national');
    expect(board.me).toEqual({
      rank: expect.any(Number) as number,
      xp: 115,
    });
    const mine = board.entries.find((e) => e.user.id === userId);
    expect(mine).toMatchObject({ xp: 115, level: 2 });
    for (const entry of board.entries) {
      expect(Object.keys(entry.user).sort()).toEqual(PUBLIC_USER_KEYS);
    }
    const keys = collectKeys(national.body);
    for (const forbidden of [
      'email',
      'phone',
      'supabase_user_id',
      'last_login_at',
      'role',
      'status',
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(JSON.stringify(national.body)).not.toContain('@example.test');
    expect(JSON.stringify(national.body)).not.toContain('+62 800');

    const province = await get(
      token,
      `leaderboard?scope=province&provinsiKode=${SUMSEL}`,
    ).expect(200);
    expect(province.body).toMatchObject({
      scope: 'province',
      provinsi_kode: SUMSEL,
      me: { xp: 115 },
    });
    expect(
      (province.body as LeaderboardView).entries.some(
        (e) => e.user.id === userId,
      ),
    ).toBe(true);
    // A province where the user earned nothing: no rank.
    const other = await get(
      token,
      'leaderboard?scope=province&provinsiKode=32',
    ).expect(200);
    expect((other.body as LeaderboardView).me).toEqual({ rank: null, xp: 0 });
  });

  it('400 for unknown types, bad province codes and PROT that are not ARSIP_NASIONAL', async () => {
    const { token } = await login('bad');
    await activity(token, 'PASPOR_STAMP', SUMSEL).expect(400);
    await activity(token, 'QUIZ_PASSED', 'x').expect(400);
    await activity(token, undefined, SUMSEL).expect(400);
    await activity(token, 'PROVINCE_ENTER', '99').expect(400);
    await activity(token, 'PROVINCE_ENTER', '16.71').expect(400);
    await activity(token, 'PROT_VIEW', draftProtId).expect(400);
    await activity(token, 'PROT_VIEW', randomUUID()).expect(400);
    await activity(token, 'PROT_VIEW', 'not-a-uuid').expect(400);
    // Client-chosen amounts or keys are refused outright.
    await request(server())
      .post('/api/rewards/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'PROVINCE_ENTER', refId: SUMSEL, xp: 9999 })
      .expect(400);
    await get(token, 'leaderboard?scope=province').expect(400);
    await get(token, 'leaderboard?scope=province&provinsiKode=99').expect(400);
    await get(token, 'leaderboard?scope=world').expect(400);

    const me = await get(token, 'me').expect(200);
    expect(me.body).toMatchObject({ xp: 0, level: 1 });
  });

  it('admin adjust: 403 for non-admins, 200 + audited compensating row for admin_kpoti', async () => {
    const target = await login('target');
    const admin = await login('admin');
    const body = {
      userId: target.userId,
      currency: 'XP',
      amount: 150,
      reason: 'Koreksi e2e',
    };

    await request(server())
      .post('/api/admin/rewards/adjust')
      .set('Authorization', `Bearer ${target.token}`)
      .send(body)
      .expect(403);

    // The role is read from the database on every request.
    await dataSource
      .getRepository(User)
      .update({ id: admin.userId }, { role: UserRole.ADMIN_KPOTI });

    await request(server())
      .post('/api/admin/rewards/adjust')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...body, reason: 'abc ' })
      .expect(400);
    // Positive Points for an unverified email are refused.
    await request(server())
      .post('/api/admin/rewards/adjust')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...body, currency: 'POINTS', amount: 5 })
      .expect(400);

    const res = await request(server())
      .post('/api/admin/rewards/adjust')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(body)
      .expect(200);
    expect(res.body).toMatchObject({
      id: expect.any(String) as string,
      granted: { xp: 150, points: 0 },
      balance: { xp: 150 },
      level: 2,
      levelUp: true,
    });

    const ledger = await get(target.token, 'me/ledger').expect(200);
    expect((ledger.body as Paginated<LedgerItem>).data).toEqual([
      expect.objectContaining({
        rule_code: 'ADMIN_ADJUST',
        amount: 150,
        currency: 'XP',
        reason: 'Koreksi e2e',
      }),
    ]);

    // AuditInterceptor writes the row in the background (not awaited): poll.
    let audit: { entity_id: string }[] = [];
    for (let i = 0; i < 50 && audit.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      audit = await dataSource.query<{ entity_id: string }[]>(
        'SELECT entity_id FROM audit_logs WHERE user_id = $1',
        [admin.userId],
      );
    }
    expect(audit).toEqual([{ entity_id: (res.body as { id: string }).id }]);
    await dataSource.query('DELETE FROM audit_logs WHERE user_id = $1', [
      admin.userId,
    ]);
  });
});
