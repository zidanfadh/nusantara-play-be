import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/** Fixed id of the DEMO event seeded by src/scripts/db-local-setup.ts. */
const DEMO_EVENT_ID = '00000000-0000-4000-8000-00000000de21';

// Uses the local test database (test/jest-e2e.json: global setup + test env).
// The full AppModule is booted (EventsModule alone has no database or config)
// with the same global prefix and ValidationPipe as src/main.ts.
describe('Events (e2e)', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
    await app.close();
  });

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

  // TODO(auth phase): these tests log in through POST /api/auth/login, which
  // does not exist (auth is Supabase today). Re-enable and rewrite them when
  // the self-hosted auth module lands. Kept as written, skipped.
  describe.skip('Event CRUD Operations (needs login, see TODO)', () => {
    let authToken: string;
    let eventId: string;
    let daerahId: string;

    beforeAll(async () => {
      // Get auth token first
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'kurator@test.com',
          password: 'password123',
        })
        .expect(200);

      authToken = `Bearer ${loginResponse.body.access_token}`;

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
        it('should register for event (requires user token)', async () => {
          // First publish event
          await request(app.getHttpServer())
            .patch(`/api/events/${eventId}/publish`)
            .set('Authorization', authToken)
            .expect(200);

          // Registration requires user authentication
          const userResponse = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({
              email: 'user@test.com',
              password: 'password123',
            })
            .expect(200);

          const userToken = `Bearer ${userResponse.body.access_token}`;

          const response = await request(app.getHttpServer())
            .post(`/api/events/${eventId}/register`)
            .set('Authorization', userToken)
            .send({})
            .expect(201)
            .expect((res) => {
              expect(res.body).toHaveProperty('id');
              expect(res.body.event_id).toBe(eventId);
              expect(res.body.user_id).toBe('user@test.com');
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
        it('should get user registrations', async () => {
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

          // Get my registrations
          const userResponse = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({
              email: 'user@test.com',
              password: 'password123',
            })
            .expect(200);

          const userToken = `Bearer ${userResponse.body.access_token}`;

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
          .set('Authorization', authToken)
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
