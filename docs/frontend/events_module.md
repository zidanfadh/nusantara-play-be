# Events Module Documentation

## Overview
Events module menangani manajemen acara budaya di platform Nusantara Play. Module ini menyediakan endpoint untuk CRUD event, pendaftaran peserta, check-in, dan update status otomatis berdasarkan tanggal.

## Base URL
```
/api/events
```

---

## Data Model

### Event Entity

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| nama | string | Yes | Nama event |
| deskripsi | text | Yes | Deskripsi lengkap event |
| jenis | enum | Yes | `teras_bermain`, `workshop`, `festival` |
| status | enum | Auto | `draft`, `published`, `ongoing`, `completed`, `cancelled` (default: draft) |
| tanggal_mulai | timestamp | Yes | Tanggal mulai event |
| tanggal_selesai | timestamp | Yes | Tanggal selesai event |
| lokasi | string | Yes | Lokasi/nama venue |
| daerah_id | UUID | Yes | ID daerah (region) |
| latitude | decimal | No | Latitude lokasi |
| longitude | decimal | No | Longitude lokasi |
| kuota_peserta | integer | No | Kuota maksimum peserta |
| jumlah_peserta | integer | Auto | Jumlah peserta terdaftar (auto-update) |
| banner_url | string | No | URL banner event |
| galeri_foto | jsonb | No | Array foto galeri |
| persyaratan | text | No | Persyaratan peserta |
| formulir_custom | jsonb | No | Formulir pendaftaran custom |
| contact_person | string | No | Nama kontak person |
| contact_phone | string | No | No telepon kontak |
| contact_email | string | No | Email kontak |
| published_at | timestamp | No | Tanggal publish |
| created_at | timestamp | Auto | Tanggal dibuat |
| updated_at | timestamp | Auto | Tanggal diupdate |
| created_by | UUID | Auto | ID user yang membuat |

### EventJenis Enum

| Value | Description |
|--------|-------------|
| `teras_bermain` | Sesi bermain kasual komunitas |
| `workshop` | Sesi pembelajaran pelatihan |
| `festival` | Event budaya skala besar |

### EventStatus Enum

| Value | Description |
|--------|-------------|
| `draft` | Draft, hanya visible oleh pembuat |
| `published` | Dipublish, visible ke publik |
| `ongoing` | Sedang berlangsung (auto saat tanggal mulai) |
| `completed` | Selesai (auto saat tanggal selesai) |
| `cancelled` | Dibatalkan |

### Status Flow

```
[draft] ──publish──▶ [published] ──auto──▶ [ongoing] ──auto──▶ [completed]
                                            │
                                            └─cancel──▶ [cancelled]
```

**Catatan:**
- Transisi `draft` → `published`: Manual oleh kurator/admin
- Transisi `published` → `ongoing`: Otomatis saat `now >= tanggal_mulai`
- Transisi `ongoing` → `completed`: Otomatis saat `now >= tanggal_selesai`
- Transisi apapun → `cancelled`: Manual oleh kurator/admin

### EventRegistration Entity

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| event_id | UUID | Yes | ID event |
| user_id | UUID | Yes | ID user peserta |
| data_pendaftaran | jsonb | Yes | Data pendaftaran |
| status | enum | Auto | `registered`, `checked_in`, `cancelled` (default: registered) |
| checked_in_at | timestamp | No | Waktu check-in |
| certificate_id | UUID | No | ID sertifikat |
| created_at | timestamp | Auto | Tanggal daftar |
| updated_at | timestamp | Auto | Tanggal diupdate |

### RegistrationStatus Enum

| Value | Description |
|--------|-------------|
| `registered` | Terdaftar |
| `checked_in` | Sudah check-in |
| `cancelled` | Batal daftar |

---

## API Endpoints

### 1. Create Event

**Endpoint:** `POST /api/events`

**Auth:** Required (Kurator+)

**Request Body:**
```json
{
  "nama": "Teras Bermain Congklak",
  "deskripsi": "Belajar congklak bersama komunitas",
  "jenis": "teras_bermain",
  "tanggal_mulai": "2026-03-01T10:00:00Z",
  "tanggal_selesai": "2026-03-01T12:00:00Z",
  "lokasi": "Taman Budaya Jakarta",
  "daerah_id": "uuid-daerah",
  "kuota_peserta": 30,
  "persyaratan": "Membawa minat dan semangat belajar",
  "contact_person": "Budi Santoso",
  "contact_phone": "08123456789",
  "contact_email": "budi@example.com"
}
```

**Response (201):**
```json
{
  "id": "uuid-event",
  "nama": "Teras Bermain Congklak",
  "jenis": "teras_bermain",
  "status": "draft",
  "tanggal_mulai": "2026-03-01T10:00:00.000Z",
  "tanggal_selesai": "2026-03-01T12:00:00.000Z",
  ...
}
```

**Errors:**
- `400` - Invalid daerah_id
- `401` - Unauthorized

---

### 2. List Events

**Endpoint:** `GET /api/events`

**Auth:** Optional (Public)

**Query Parameters:**

| Param | Type | Required | Description |
|--------|------|----------|-------------|
| jenis | string | No | Filter by jenis (teras_bermain/workshop/festival) |
| type | string | No | Alias for jenis |
| daerah_id | string | No | Filter by region |
| startDate | string | No | Filter events after this date (ISO 8601) |
| endDate | string | No | Filter events before this date (ISO 8601) |
| status | string | No | Filter by status |
| search | string | No | Search in nama/deskripsi |
| sortBy | string | No | `tanggal_mulai`, `created_at`, `jumlah_peserta` (default: tanggal_mulai) |
| sortOrder | string | No | `ASC`, `DESC` (default: ASC) |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20) |

**Example:**
```
GET /api/events?jenis=teras_bermain&daerah_id=xxx&page=1&limit=10
```

**Response (200):**
```json
{
  "data": [...],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Catatan:** Draft events hanya visible oleh pembuatnya saja.

---

### 3. Get My Events

**Endpoint:** `GET /api/events/my-events`

**Auth:** Required (Kurator+)

**Query Parameters:** Same as list events

**Response:** Same as list events, filtered by created_by = current user

---

### 4. Get Event by ID

**Endpoint:** `GET /api/events/:id`

**Auth:** Optional (Public)

**Response (200):**
```json
{
  "id": "uuid-event",
  "nama": "Teras Bermain Congklak",
  "deskripsi": "...",
  "jenis": "teras_bermain",
  "status": "published",
  "tanggal_mulai": "2026-03-01T10:00:00.000Z",
  "tanggal_selesai": "2026-03-01T12:00:00.000Z",
  "lokasi": "Taman Budaya Jakarta",
  "daerah_id": "uuid-daerah",
  "daerah": {
    "id": "uuid-daerah",
    "nama": "DKI Jakarta",
    ...
  },
  "organizer": {
    "id": "uuid-user",
    "full_name": "Budi Santoso",
    ...
  }
}
```

**Errors:**
- `404` - Event not found
- `403` - Draft event accessed by non-creator

---

### 5. Update Event

**Endpoint:** `PATCH /api/events/:id`

**Auth:** Required (Kurator+, only own events)

**Request Body:** All fields optional
```json
{
  "nama": "Updated Event Name",
  "kuota_peserta": 50
}
```

**Response (200):** Updated event object

**Errors:**
- `400` - Event is not in draft status
- `403` - Not event creator
- `404` - Event not found

**Catatan:** Hanya event dengan status `draft` yang bisa diedit.

---

### 6. Delete Event

**Endpoint:** `DELETE /api/events/:id`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
{
  "message": "Event deleted successfully"
}
```

**Errors:**
- `403` - Not event creator
- `404` - Event not found

---

### 7. Publish Event

**Endpoint:** `PATCH /api/events/:id/publish`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
{
  "id": "uuid",
  "status": "published",
  "published_at": "2026-02-11T10:30:00.000Z",
  ...
}
```

**Errors:**
- `400` - Event is not in draft status
- `403` - Not event creator
- `404` - Event not found

---

### 8. Cancel Event

**Endpoint:** `PATCH /api/events/:id/cancel`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
{
  "id": "uuid",
  "status": "cancelled",
  ...
}
```

**Errors:**
- `400` - Event already completed or cancelled
- `403` - Not event creator
- `404` - Event not found

---

### 9. Register for Event

**Endpoint:** `POST /api/events/:id/register`

**Auth:** Required

**Request Body (Optional):**
```json
{
  "data_pendaftaran": {
    "nama": "John Doe",
    "email": "john@example.com",
    "telepon": "08123456789"
  }
}
```

**Response (201):**
```json
{
  "id": "uuid-registration",
  "event_id": "uuid-event",
  "user_id": "uuid-user",
  "status": "registered",
  "data_pendaftaran": {...},
  "created_at": "2026-02-11T10:30:00.000Z"
}
```

**Errors:**
- `400` - Registration closed, event fully booked
- `409` - Already registered

---

### 10. Cancel Registration

**Endpoint:** `DELETE /api/events/:id/register`

**Auth:** Required

**Response (200):**
```json
{
  "message": "Registration cancelled successfully"
}
```

**Errors:**
- `400` - Cannot cancel after check-in
- `404` - Registration not found

---

### 11. Get My Registrations

**Endpoint:** `GET /api/events/my-registrations`

**Auth:** Required

**Response (200):**
```json
[
  {
    "id": "uuid-registration",
    "event_id": "uuid-event",
    "user_id": "uuid-user",
    "status": "registered",
    "event": {
      "id": "uuid-event",
      "nama": "Teras Bermain Congklak",
      "tanggal_mulai": "2026-03-01T10:00:00.000Z",
      ...
    }
  }
]
```

---

### 12. Get Event Registrations

**Endpoint:** `GET /api/events/:id/registrations`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
[
  {
    "id": "uuid-registration",
    "event_id": "uuid-event",
    "user_id": "uuid-user",
    "status": "registered",
    "data_pendaftaran": {...},
    "created_at": "2026-02-11T10:30:00.000Z",
    "user": {
      "id": "uuid-user",
      "full_name": "John Doe",
      "email": "john@example.com"
    }
  }
]
```

**Errors:**
- `403` - Not event organizer
- `404` - Event not found

---

### 13. Check-in Attendee

**Endpoint:** `PATCH /api/events/:id/registrations/:userId/check-in`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
{
  "id": "uuid-registration",
  "status": "checked_in",
  "checked_in_at": "2026-03-01T10:15:00.000Z",
  ...
}
```

**Errors:**
- `400` - Already checked in, registration cancelled
- `404` - Registration not found

---

### 14. Undo Check-in

**Endpoint:** `PATCH /api/events/:id/registrations/:userId/undo-check-in`

**Auth:** Required (Kurator+, only own events)

**Response (200):**
```json
{
  "id": "uuid-registration",
  "status": "registered",
  "checked_in_at": null,
  ...
}
```

**Errors:**
- `400` - Attendee is not checked in
- `404` - Registration not found

---

## Permissions

| Role | Create | Edit | Delete | View Draft | Publish | Cancel | Check-in |
|-------|---------|-------|--------|-----------|---------|----------|
| admin_kpoti | All | All | All | All | All | Own events |
| kurator_daerah | Yes | Own | Own | Own | Own | Own events |
| pakar | No | No | No | No | No | No |
| publik | No | No | No | No | No | No |

---

## Common Use Cases

### 1. Kurator membuat dan publish event

```javascript
// 1. Buat event (draft)
POST /api/events
{
  "nama": "Workshop Batik",
  "jenis": "workshop",
  "tanggal_mulai": "2026-03-15T09:00:00Z",
  "tanggal_selesai": "2026-03-15T15:00:00Z",
  "lokasi": "Balai Budaya",
  "daerah_id": "xxx"
}
// Status: draft

// 2. Publish event
PATCH /api/events/:id/publish
// Status: published, now visible to public
```

### 2. User mendaftar event

```javascript
POST /api/events/:id/register
{
  "data_pendaftaran": {
    "nama": "Peserta",
    "email": "peserta@email.com"
  }
}
// Status: registered
```

### 3. Organizer check-in peserta

```javascript
// Di lokasi event, scan QR code atau pilih dari list
PATCH /api/events/:id/registrations/:userId/check-in
// Status: checked_in, checked_in_at terisi
```

### 4. Status update otomatis

```javascript
// Scheduler berjalan setiap 5 menit
// - published → ongoing saat tanggal_mulai terlewati
// - ongoing → completed saat tanggal_selesai terlewati
```

---

## Error Codes

| Code | Description |
|-------|-------------|
| 400 | Bad Request - Invalid input, registration closed, etc. |
| 401 | Unauthorized - No authentication |
| 403 | Forbidden - No permission |
| 404 | Not Found - Event/registration doesn't exist |
| 409 | Conflict - Duplicate registration |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |
