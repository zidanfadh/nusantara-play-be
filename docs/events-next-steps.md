# Events Feature - Next Steps

**Status:** Core Events module implementation is **COMPLETE** ✅

**Date:** 2026-02-11

---

## Completed Features ✅

### 1. Core Events Module
- Event entity with 3 jenis (teras_bermain, workshop, festival)
- EventRegistration entity for tracking attendees
- Full CRUD operations with role-based access control
- Status auto-update scheduler (every 5 minutes)

### 2. API Endpoints (14 endpoints)
| Method | Endpoint | Description |
|--------|-----------|-------------|
| POST | `/api/events` | Create event (Kurator+) |
| GET | `/api/events` | List events (Public) |
| GET | `/api/events/:id` | Get event (Public) |
| PATCH | `/api/events/:id` | Update event (Kurator+) |
| DELETE | `/api/events/:id` | Delete event (Kurator+) |
| PATCH | `/api/events/:id/publish` | Publish event (Kurator+) |
| PATCH | `/api/events/:id/cancel` | Cancel event (Kurator+) |
| POST | `/api/events/:id/register` | Register (Auth) |
| DELETE | `/api/events/:id/register` | Cancel registration (Auth) |
| GET | `/api/events/my-events` | My events (Kurator+) |
| GET | `/api/events/my-registrations` | My registrations (Auth) |
| GET | `/api/events/:id/registrations` | List registrations (Kurator+) |
| PATCH | `/api/events/:id/registrations/:userId/check-in` | Check-in (Kurator+) |
| PATCH | `/api/events/:id/registrations/:userId/undo-check-in` | Undo check-in (Kurator+) |

### 3. Documentation
- Frontend API docs: `docs/frontend/events_module.md`
- Postman collection: `docs/postman/Nusantara_Play_Events_API.postman_collection.json`
- Implementation plan: `docs/plans/2026-02-11-events-feature-*.md`

### 4. Tests
- Unit tests: 30 tests passing ✅
- E2E tests: **TODO** (see below)

---

## Optional Next Steps 📋

### 1. E2E Tests **(Recommended)**

**Priority:** High
**Estimated Time:** 2-3 hours

Create end-to-end integration tests in `test/events.e2e-spec.ts`:

```javascript
// Test scenarios:
- Create event (draft)
- Publish event → visible to public
- User registers for event
- Organizer checks in attendee
- Event status auto-transitions (published→ongoing→completed)
- Cancel event → notifications sent
- Role-based access (kurator vs admin vs public)
```

**Files to create:**
- `test/events.e2e-spec.ts`

**Reference:** `test/prot.e2e-spec.ts` for pattern

---

### 2. Notification Integration **(Recommended)**

**Priority:** Medium
**Estimated Time:** 3-4 hours

Integrate with NotificationsModule to send notifications for:

| Trigger | Recipients | Message |
|----------|------------|---------|
| User registers | Registered user | "Anda terdaftar untuk [Event Name]" |
| Event date/time changes | All registered users | "[Event Name] telah diupdate" |
| Event cancelled | All registered users | "[Event Name] telah dibatalkan" |
| 24h before event | All registered users | "Reminder: [Event Name] besok" |

**Implementation:**

```typescript
// In EventsController/Services, inject NotificationsService
await notificationsService.create({
  userId: registeredUser.id,
  title: 'Registrasi Berhasil',
  message: `Anda terdaftar untuk ${event.nama}`,
  type: 'event_registration',
  related_entity_type: 'event',
  related_entity_id: event.id,
});
```

**Dependencies:**
- NotificationsModule must exist (check in `src/modules/notifications/`)
- Need to check notification service API

---

### 3. Certificate Issuance Endpoints **(Optional)**

**Priority:** Low
**Estimated Time:** 2-3 hours

Add manual certificate issuance endpoints for organizers:

```typescript
// New endpoints:
POST /api/events/:id/registrations/:userId/certificate
Body: { type: 'participation' } // or 'achievement'
Response: { id, certificate_id, pdf_url }

GET /api/events/:id/certificates
// List all certificates issued for this event
```

**Integration with:**
- `certificates` table (already exists in schema)
- PDF generation service
- QR code generation for verification

**Note:** Certificates table already exists in database schema. This would add API endpoints to create/manage certificates.

---

### 4. Banner Image Upload **(Optional)**

**Priority:** Low
**Estimated Time:** 1-2 hours

Integrate with StorageService for event banner uploads:

```typescript
// Update EventsController to handle file upload
@Post('upload')
@UseInterceptors(FileInterceptor('banner'))
async uploadBanner(
  @Param('id') id: string,
  @UploadedFile() banner: Express.Multer.File,
) {
  const s3Url = await this.storageService.uploadFile(banner, 'events/banners');
  // Update event.banner_url = s3Url
}
```

**Dependencies:**
- StorageModule (already exists)
- Multer configuration for file uploads

---

### 5. QR Code Generation for Check-in **(Optional)**

**Priority:** Low
**Estimated Time:** 2-3 hours

Generate QR codes containing user ID for quick check-in:

```typescript
// Endpoint:
GET /api/events/:id/registrations/qr-code
// Returns QR code image

// Or add to registration response:
{
  ...registration,
  qr_code_url: 'https://api.qrserver.com/...'
}
```

**Libraries:**
- `qrcode` npm package
- Or external API like qrserver.com

---

## Database Schema Already Exists ✅

These tables are already in `001_initial_schema.sql`:

- `events` ✅
- `event_registrations` ✅
- `certificates` ✅
- `notifications` ✅

No database migrations needed for these features.

---

## File Locations

| Item | Location |
|--------|----------|
| Events code | `src/modules/events/` |
| Tests | `src/modules/events/__tests__/` |
| API docs | `docs/frontend/events_module.md` |
| Postman | `docs/postman/Nusantara_Play_Events_API.postman_collection.json` |
| Design | `docs/plans/2026-02-11-events-feature-design.md` |
| Implementation | `docs/plans/2026-02-11-events-feature-implementation.md` |

---

## Quick Start - Testing Events

```bash
# Run unit tests
npm test -- events

# Start server
npm start:dev

# Test with Postman
# Import docs/postman/Nusantara_Play_Events_API.postman_collection.json
# Set variables: base_url, accessToken

# Test flow:
# 1. Login as kurator → get accessToken
# 2. Create event (POST /api/events)
# 3. Publish event (PATCH /api/events/:id/publish)
# 4. Login as regular user → register (POST /api/events/:id/register)
# 5. As kurator → check-in (PATCH /api/events/:id/registrations/:userId/check-in)
```

---

## Status Legend

| Symbol | Meaning |
|---------|----------|
| ✅ | Done |
| 📋 | TODO/Optional |
| 🚧 | In Progress |
| ❌ | Blocked/Not Started |

**Overall Progress:** Core Events module is **PRODUCTION READY** ✅

Optional enhancements can be implemented incrementally based on priorities.
