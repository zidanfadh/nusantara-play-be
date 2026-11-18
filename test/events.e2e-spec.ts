import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';

/** Fixed id of the DEMO event seeded by src/scripts/db-local-setup.ts. */
const DEMO_EVENT_ID = '00000000-0000-4000-8000-00000000de21';

// Uses the local test database (test/jest-e2e.json: global setup + test env).
// The full AppModule is booted (EventsModule alone has no database or config)
// with the same global prefix and ValidationPipe as src/main.ts.
describe('Events (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdEmails: string[] = [];

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
  });

  afterAll(async () => {
    if (createdEmails.length) {
      await dataSource.query(
        `DELETE FROM event_registrations WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))`,
        [createdEmails],
      );
      await dataSource.query(
        `DELETE FROM events WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1))`,
        [createdEmails],
      );
      await dataSource.query(`DELETE FROM users WHERE email = ANY($1)`, [
        createdEmails,
      ]);
    }
    await app.close();
  });

  /**
   * Phase 08: a real account through POST /api/auth/register, the role set
   * in the database (register always creates publik), then
   * POST /api/auth/login. Returns "Bearer <accessToken>" and the user id.
   */
  async function registerAndLogin(
    label: string,
    role?: string,
  ): Promise<{ authHeader: string; userId: string }> {
    const email = `e2e-events-${label}-${randomUUID().slice(0, 8)}@example.test`;
    const password = 'events e2e password';
    createdEmails.push(email);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, full_name: `E2E ${label}` })
      .expect(201);
    if (role) {
      await dataSource.query(`UPDATE users SET role = $1 WHERE email = $2`, [
        role,
        email,
      ]);
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      authHeader: `Bearer ${login.body.accessToken}`,
      userId: login.body.user.id,
    };
  }

  describe('Health Check', () => {
    it('should get API info', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Nusantara Play API');
      expect(response.body.endpoints).toHaveProperty('health');
    });
  });

  // Tests that run without login (public routes and 401 checks).
  describe('Without login', () => {
    it('GET /api/events lists events publicly', async () => {
      await request(app.getHttpServer())
        .get('/api/events')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body).toHaveProperty('pagination');
          expect(res.body.data.map((e: { id: string }) => e.id)).toContain(
            DEMO_EVENT_ID,
          );
        });
    });

    it('GET /api/events?jenis=teras_bermain filters by jenis', async () => {
      await request(app.getHttpServer())
        .get('/api/events?jenis=teras_bermain')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
          for (const event of res.body.data) {
            expect(event.jenis).toBe('teras_bermain');
          }
        });
    });

    it('GET /api/events/:id returns a published event without auth', async () => {
      await request(app.getHttpServer())
        .get(`/api/events/${DEMO_EVENT_ID}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(DEMO_EVENT_ID);
          expect(res.body.status).toBe('published');
        });
    });

    it('POST /api/events fails without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
        .send({
          nama: 'Test Event',
          deskripsi: 'Test Description',
          jenis: 'teras_bermain',
        })
        .expect(401);
    });

    it('POST /api/events/:id/register fails without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/events/${DEMO_EVENT_ID}/register`)
        .send({})
        .expect(401);
    });
  });

  // Phase 08: these tests log in through the self-hosted POST /api/auth/login
  // (a kurator_daerah who creates events and a publik user who registers).
  describe('Event CRUD Operations (logged in)', () => {
    let authToken: string;
    let userToken: string;
    let userId: string;
    let eventId: string;
    let daerahId: string;

    beforeAll(async () => {
      authToken = (await registerAndLogin('kurator', 'kurator_daerah'))
        .authHeader;
      const publik = await registerAndLogin('user');
      userToken = publik.authHeader;
      userId = publik.userId;

      // Get a daerah for testing
      const daerahResponse = await request(app.getHttpServer())
        .get('/api/daerah?page=1&limit=10')
        .set('Authorization', authToken)
        .expect(200);

      if (daerahResponse.body.data && daerahResponse.body.data.length > 0) {
        daerahId = daerahResponse.body.data[0].id;
      }
    });

    describe('POST /api/events - Create Event', () => {
      it('should create a new event', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Test Event',
            deskripsi: 'Test Event Description',
            jenis: 'teras_bermain',
            tanggal_mulai: '2026-03-01T10:00:00Z',
            tanggal_selesai: '2026-03-01T12:00:00Z',
            lokasi: 'Test Location',
            daerah_id: daerahId,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.nama).toBe('Test Event');
            expect(res.body.status).toBe('draft');
            eventId = res.body.id;
          });
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .post('/api/events')
          .send({
            nama: 'Test Event',
            deskripsi: 'Test Description',
            jenis: 'teras_bermain',
          })
          .expect(401);
      });

      it('should validate required fields', async () => {
        await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Test Event',
            // Missing required fields
          })
          .expect(400);
      });
    });

    describe('PATCH /api/events/:id/publish - Publish Event', () => {
      it('should publish a draft event', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/events/${eventId}/publish`)
          .set('Authorization', authToken)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('published');
            expect(res.body.published_at).toBeDefined();
            expect(res.body.published_at).not.toBeNull();
          });
      });
    });

    describe('GET /api/events - List Events', () => {
      it('should list events publicly', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/events')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body).toHaveProperty('pagination');
          });
      });

      it('should filter events by jenis', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/events?jenis=teras_bermain')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
              expect(res.body.data[0].jenis).toBe('teras_bermain');
            }
          });
      });
    });

    describe('Event Registration', () => {
      describe('POST /api/events/:id/register', () => {
        // Still skipped after Phase 08: fails for reasons other than login
        // (it publishes the already-published event -> 400, the event starts
        // 2026-03-01 so registration is closed, and the my-registrations
        // test expects both an array and a .data property). Fix with the
        // events tests, not in the auth phase.
        it.skip('should register for event (requires user token)', async () => {
          // First publish event
          await request(app.getHttpServer())
            .patch(`/api/events/${eventId}/publish`)
            .set('Authorization', authToken)
            .expect(200);

          // Registration requires user authentication (userToken, beforeAll)
          const response = await request(app.getHttpServer())
            .post(`/api/events/${eventId}/register`)
            .set('Authorization', userToken)
            .send({})
            .expect(201)
            .expect((res) => {
              expect(res.body).toHaveProperty('id');
              expect(res.body.event_id).toBe(eventId);
              expect(res.body.user_id).toBe(userId);
              expect(res.body.status).toBe('registered');
            });
        });

        it('should fail without authentication', async () => {
          await request(app.getHttpServer())
            .post(`/api/events/${eventId}/register`)
            .send({})
            .expect(401);
        });
      });

      describe('GET /api/events/my-registrations', () => {
        // Still skipped after Phase 08: fails for reasons other than login
        // (it publishes the already-published event -> 400, the event starts
        // 2026-03-01 so registration is closed, and the my-registrations
        // test expects both an array and a .data property). Fix with the
        // events tests, not in the auth phase.
        it.skip('should get user registrations', async () => {
          // First register
          await request(app.getHttpServer())
            .patch(`/api/events/${eventId}/publish`)
            .set('Authorization', authToken)
            .expect(200);

          await request(app.getHttpServer())
            .post(`/api/events/${eventId}/register`)
            .set('Authorization', authToken)
            .send({})
            .expect(201);

          // Get my registrations (userToken, beforeAll)
          const response = await request(app.getHttpServer())
            .get('/api/events/my-registrations')
            .set('Authorization', userToken)
            .expect(200)
            .expect((res) => {
              expect(Array.isArray(res.body)).toBe(true);
              expect(res.body.data.length).toBeGreaterThan(0);
              res.body.data.forEach((reg: any) => {
                expect(reg).toHaveProperty('event');
              });
            });
        });
      });
    });

    describe('Event Access Control', () => {
      it('draft event only visible to creator', async () => {
        // Create draft event
        const createResponse = await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Draft Event Test',
            deskripsi: 'Draft event',
            jenis: 'teras_bermain',
            tanggal_mulai: '2026-03-01T10:00:00Z',
            tanggal_selesai: '2026-03-01T12:00:00Z',
            lokasi: 'Draft Location',
            daerah_id: daerahId,
          })
          .expect(201);

        const draftId = createResponse.body.id;

        // Creator can access
        await request(app.getHttpServer())
          .get(`/api/events/${draftId}`)
          .set('Authorization', authToken)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(draftId);
          });

        // Other user cannot access
        await request(app.getHttpServer())
          .get(`/api/events/${draftId}`)
          .set('Authorization', userToken)
          .expect(403);
      });

      it('published event visible to all', async () => {
        // Create and publish event
        const createResponse = await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Published Event Test',
            deskripsi: 'Published event',
            jenis: 'workshop',
            tanggal_mulai: '2026-03-01T10:00:00Z',
            tanggal_selesai: '2026-03-01T12:00:00Z',
            lokasi: 'Published Location',
            daerah_id: daerahId,
          })
          .expect(201);

        await request(app.getHttpServer())
          .patch(`/api/events/${createResponse.body.id}/publish`)
          .set('Authorization', authToken)
          .expect(200);

        const publishedId = createResponse.body.id;

        // Anyone can access (no auth needed)
        await request(app.getHttpServer())
          .get(`/api/events/${publishedId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(publishedId);
            expect(res.body.status).toBe('published');
          });
      });
    });
  });
});
