import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { EventsModule } from './../src/modules/events/events.module';

describe('Events (e2e)', () => {
  let app: INestApplication<any>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
      expect(response.body.endpoints).toHaveProperty('events');
    });
  });

  describe('Event CRUD Operations', () => {
    let authToken: string;
    let eventId: string;
    let daerahId: string;

    beforeAll(async () => {
      // Get auth token first (you need to login via Postman/Swagger first)
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
          })
          .expect(401);
      });

      it('should validate required fields', async () => {
        const response = await request(app.getHttpServer())
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

      it('should search events', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/events?search=Test')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body.data)).toBe(true);
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
            });
        });
      });
    });

    describe('Event Access Control', () => {
      it('should only show draft event to creator', async () => {
        // Create draft event
        const createResponse = await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Draft Event',
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
        const userResponse = await request(app.getHttpServer())
          .post('/api/auth/login')
            .send({
              email: 'user@test.com',
              password: 'password123',
            })
            .expect(200);

        const userToken = `Bearer ${userResponse.body.access_token}`;

        await request(app.getHttpServer())
          .get(`/api/events/${draftId}`)
          .set('Authorization', userToken)
          .expect(403); // Forbidden
      });

      it('published event visible to all', async () => {
        // Create and publish event
        const createResponse = await request(app.getHttpServer())
          .post('/api/events')
          .set('Authorization', authToken)
          .send({
            nama: 'Published Event',
            deskripsi: 'Published event',
            jenis: 'workshop',
            tanggal_mulai: '2026-03-01T10:00:00Z',
            tanggal_selesai: '2026-03-01T12:00:00Z',
            lokasi: 'Published Location',
            daerah_id: daerahId,
          })
          .expect(201);

        const publishedId = createResponse.body.id;

        await request(app.getHttpServer())
          .patch(`/api/events/${publishedId}/publish`)
          .set('Authorization', authToken)
          .expect(200);

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
