/**
 * Phase 06, P1: every @Public() endpoint that returns a user object returns
 * it ONLY in the public shape (id, full_name, avatar_url, institution).
 * Full AppModule against the local test database, without login.
 *
 * The test data gets an email, phone, supabase_user_id and last_login_at
 * on purpose, so a leak would be visible.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import {
  CalendarItem,
  CalendarItemType,
  CalendarItemVisibility,
} from '../src/modules/calendar/entities/calendar-item.entity';

/** Fixed id of the DEMO event seeded by src/scripts/db-local-setup.ts. */
const DEMO_EVENT_ID = '00000000-0000-4000-8000-00000000de21';

const PUBLIC_USER_KEYS = ['avatar_url', 'full_name', 'id', 'institution'];
const FORBIDDEN_KEYS = ['email', 'phone', 'supabase_user_id', 'last_login_at'];

/** Every object anywhere in the body that looks like a user record. */
function collectUsers(value: unknown, found: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectUsers(item, found));
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('full_name' in record) {
      found.push(record);
    }
    Object.values(record).forEach((item) => collectUsers(item, found));
  }
  return found;
}

/** No key anywhere in the body may be a private user field. */
function collectKeys(value: unknown, keys = new Set<string>()) {
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

function expectOnlyPublicUsers(body: unknown, minUsers: number) {
  const users = collectUsers(body);
  expect(users.length).toBeGreaterThanOrEqual(minUsers);
  for (const user of users) {
    expect(Object.keys(user).sort()).toEqual(PUBLIC_USER_KEYS);
  }
  const keys = collectKeys(body);
  expect(keys.has('supabase_user_id')).toBe(false);
  expect(keys.has('last_login_at')).toBe(false);
  for (const user of users) {
    for (const key of FORBIDDEN_KEYS) {
      expect(user).not.toHaveProperty(key);
    }
  }
}

describe('Public endpoints return only the public user shape (e2e, P1)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let organizerEmail: string;
  let calendarUser: User;
  let calendarItemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    // Make the DEMO organizer's private fields non-empty, so a leak shows.
    const [demoEvent] = await dataSource.query<{ created_by: string }[]>(
      `SELECT created_by FROM events WHERE id = $1`,
      [DEMO_EVENT_ID],
    );
    await dataSource.query(
      `UPDATE users SET phone = '+62 800 1111 2222', last_login_at = now() WHERE id = $1`,
      [demoEvent.created_by],
    );
    const organizer = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: demoEvent.created_by });
    organizerEmail = organizer.email;

    const suffix = randomUUID().slice(0, 8);
    calendarUser = await dataSource.getRepository(User).save({
      supabase_user_id: randomUUID(),
      email: `e2e-cal-${suffix}@example.test`,
      full_name: `E2E Calendar ${suffix}`,
      phone: '+62 800 3333 4444',
      last_login_at: new Date(),
    });
    const item = await dataSource.getRepository(CalendarItem).save({
      title: `E2E public item ${suffix}`,
      type: CalendarItemType.IMPORTANT_DATE,
      visibility: CalendarItemVisibility.PUBLIC,
      start_date: new Date(),
      created_by: calendarUser.id,
    });
    calendarItemId = item.id;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM calendar_items WHERE id = $1`, [
      calendarItemId,
    ]);
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [
      calendarUser.id,
    ]);
    await app.close();
  });

  it('GET /api/events', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/events')
      .expect(200);

    expectOnlyPublicUsers(res.body, 1);
    expect(JSON.stringify(res.body)).not.toContain(organizerEmail);
    expect(JSON.stringify(res.body)).not.toContain('+62 800 1111 2222');
  });

  it('GET /api/events/featured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/events/featured')
      .expect(200);

    expectOnlyPublicUsers(res.body, 1);
    expect(JSON.stringify(res.body)).not.toContain(organizerEmail);
  });

  it('GET /api/events/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/events/${DEMO_EVENT_ID}`)
      .expect(200);

    expectOnlyPublicUsers(res.body, 1);
    const body = res.body as { organizer: Record<string, unknown> };
    expect(Object.keys(body.organizer).sort()).toEqual(PUBLIC_USER_KEYS);
    expect(JSON.stringify(res.body)).not.toContain(organizerEmail);
  });

  it('GET /api/calendar/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/calendar/${calendarItemId}`)
      .expect(200);

    expectOnlyPublicUsers(res.body, 1);
    const body = res.body as { creator: Record<string, unknown> };
    expect(body.creator.id).toBe(calendarUser.id);
    expect(JSON.stringify(res.body)).not.toContain(calendarUser.email);
    expect(JSON.stringify(res.body)).not.toContain('+62 800 3333 4444');
  });
});
