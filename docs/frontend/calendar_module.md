# Calendar Module Documentation

## Overview

Modul Calendar menyediakan fitur kalender terintegrasi untuk platform Nusantara Play. Kalender menggabungkan tiga sumber data: **tanggal penting** (hari budaya, peringatan nasional, dll), **jadwal pribadi** user, dan **event publik** dari modul Events. Dilengkapi dengan visibility role-based (public/internal/private) dan sistem undangan (invite) untuk berbagi jadwal pribadi.

## Base URL

```
/calendar
```

---

## Data Model

### CalendarItem Entity

| Field         | Type      | Required | Description                                          |
| ------------- | --------- | -------- | ---------------------------------------------------- |
| `id`          | UUID      | Auto     | Primary key                                          |
| `title`       | string    | Ya       | Judul item kalender                                  |
| `description` | text      | Tidak    | Deskripsi detail                                     |
| `type`        | enum      | Ya       | Tipe item: `important_date` atau `personal_schedule` |
| `visibility`  | enum      | Ya       | Visibilitas: `public`, `internal`, atau `private`    |
| `start_date`  | timestamp | Ya       | Tanggal/waktu mulai                                  |
| `end_date`    | timestamp | Tidak    | Tanggal/waktu selesai (null = satu titik waktu)      |
| `all_day`     | boolean   | Tidak    | Sepanjang hari (default: `true`)                     |
| `color`       | string    | Tidak    | Hex color untuk UI (contoh: `#FF5733`)               |
| `daerah_id`   | UUID      | Tidak    | ID daerah terkait                                    |
| `event_id`    | UUID      | Tidak    | Link ke event (unique)                               |
| `created_by`  | UUID      | Auto     | ID user pembuat                                      |
| `updated_by`  | UUID      | Tidak    | ID user terakhir edit                                |
| `created_at`  | timestamp | Auto     | Waktu dibuat                                         |
| `updated_at`  | timestamp | Auto     | Waktu terakhir diubah                                |

### CalendarInvite Entity

| Field              | Type      | Required | Description                                        |
| ------------------ | --------- | -------- | -------------------------------------------------- |
| `id`               | UUID      | Auto     | Primary key                                        |
| `calendar_item_id` | UUID      | Ya       | ID item kalender                                   |
| `user_id`          | UUID      | Ya       | ID user yang diundang                              |
| `status`           | enum      | Ya       | Status undangan: `pending`, `accepted`, `declined` |
| `invited_by`       | UUID      | Ya       | ID user yang mengundang                            |
| `created_at`       | timestamp | Auto     | Waktu dibuat                                       |
| `updated_at`       | timestamp | Auto     | Waktu terakhir diubah                              |

### Enums

#### CalendarItemType

| Value               | Description                                    |
| ------------------- | ---------------------------------------------- |
| `important_date`    | Tanggal penting (hari budaya, peringatan, dll) |
| `personal_schedule` | Jadwal pribadi user                            |

#### CalendarItemVisibility

| Value      | Description                                                       |
| ---------- | ----------------------------------------------------------------- |
| `public`   | Dapat dilihat semua orang, termasuk tanpa login                   |
| `internal` | Hanya dapat dilihat oleh `admin_kpoti`, `kurator_daerah`, `pakar` |
| `private`  | Hanya dapat dilihat oleh pembuat dan user yang diundang (invite)  |

#### CalendarInviteStatus

| Value      | Description                                |
| ---------- | ------------------------------------------ |
| `pending`  | Undangan belum direspon                    |
| `accepted` | Undangan diterima — user bisa melihat item |
| `declined` | Undangan ditolak                           |

#### CalendarView

| Value     | Description                        |
| --------- | ---------------------------------- |
| `monthly` | Tampilan bulanan (grouped by date) |
| `weekly`  | Tampilan mingguan (7 hari)         |
| `agenda`  | Tampilan agenda (flat list)        |

#### CalendarSourceFilter

| Value               | Description                     |
| ------------------- | ------------------------------- |
| `important_date`    | Hanya tampilkan tanggal penting |
| `personal_schedule` | Hanya tampilkan jadwal pribadi  |
| `event`             | Hanya tampilkan event publik    |

### CalendarEntry (Response Object)

Objek standar yang dikembalikan di setiap entry kalender (untuk calendar view dan agenda):

| Field         | Type           | Description                                         |
| ------------- | -------------- | --------------------------------------------------- |
| `id`          | UUID           | ID item                                             |
| `title`       | string         | Judul                                               |
| `description` | string/null    | Deskripsi                                           |
| `type`        | string         | `important_date`, `personal_schedule`, atau `event` |
| `visibility`  | string         | `public`, `internal`, atau `private`                |
| `start_date`  | timestamp      | Waktu mulai                                         |
| `end_date`    | timestamp/null | Waktu selesai                                       |
| `all_day`     | boolean        | Sepanjang hari                                      |
| `color`       | string/null    | Hex color                                           |
| `source`      | string         | `calendar` atau `event` — menunjukkan asal data     |
| `daerah_id`   | UUID/null      | ID daerah                                           |
| `event_id`    | UUID/null      | ID event (jika source = `event`)                    |
| `created_by`  | UUID/null      | ID pembuat                                          |

### Visibility Rules

```
┌─────────────┬──────────────────────────────────────────────────┐
│ Visibility  │ Siapa yang bisa lihat                            │
├─────────────┼──────────────────────────────────────────────────┤
│ public      │ Semua orang (termasuk tanpa auth)                │
│ internal    │ admin_kpoti, kurator_daerah, pakar               │
│ private     │ Creator + user yang diundang (invite accepted/   │
│             │ pending)                                         │
└─────────────┴──────────────────────────────────────────────────┘
```

---

## Endpoints

### 1. Lihat Kalender (Monthly/Weekly)

Mendapatkan data kalender dalam format grouped by date. Menggabungkan calendar items + event publik.

**Endpoint:** `GET /calendar`

**Authentication:** Public (optional JWT untuk melihat data internal/private)

**Query Parameters:**

| Param            | Type    | Required | Default   | Description                                                   |
| ---------------- | ------- | -------- | --------- | ------------------------------------------------------------- |
| `year`           | integer | Ya       | -         | Tahun (2020–2100)                                             |
| `month`          | integer | Ya       | -         | Bulan (1–12)                                                  |
| `view`           | string  | Tidak    | `monthly` | View: `monthly`, `weekly`, `agenda`                           |
| `week`           | integer | Tidak    | -         | Minggu ke-berapa (1–6, hanya untuk `view=weekly`)             |
| `source`         | string  | Tidak    | -         | Filter sumber: `important_date`, `personal_schedule`, `event` |
| `visibility`     | string  | Tidak    | -         | Filter visibility: `public`, `internal`, `private`            |
| `daerah_id`      | UUID    | Tidak    | -         | Filter per daerah                                             |
| `include_events` | boolean | Tidak    | `true`    | Sertakan event publik                                         |
| `search`         | string  | Tidak    | -         | Pencarian di title dan description                            |

**Success Response (200):**

```json
{
  "year": 2026,
  "month": 3,
  "view": "monthly",
  "items": [
    {
      "date": "2026-03-01",
      "entries": []
    },
    {
      "date": "2026-03-02",
      "entries": [
        {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "title": "Hari Permainan Rakyat Nasional",
          "description": "Peringatan tahunan permainan rakyat Indonesia",
          "type": "important_date",
          "visibility": "public",
          "start_date": "2026-03-02T00:00:00.000Z",
          "end_date": null,
          "all_day": true,
          "color": "#E74C3C",
          "source": "calendar",
          "daerah_id": null,
          "event_id": null,
          "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
        }
      ]
    },
    {
      "date": "2026-03-05",
      "entries": [
        {
          "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "title": "Festival Egrang Jawa Barat",
          "description": "Festival tahunan egrang di Bandung",
          "type": "event",
          "visibility": "public",
          "start_date": "2026-03-05T08:00:00.000Z",
          "end_date": "2026-03-07T17:00:00.000Z",
          "all_day": false,
          "color": null,
          "source": "event",
          "daerah_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
          "event_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
        },
        {
          "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
          "title": "Rapat Persiapan Festival",
          "description": "Koordinasi internal tim panitia",
          "type": "personal_schedule",
          "visibility": "private",
          "start_date": "2026-03-05T10:00:00.000Z",
          "end_date": "2026-03-05T12:00:00.000Z",
          "all_day": false,
          "color": "#3498DB",
          "source": "calendar",
          "daerah_id": null,
          "event_id": null,
          "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
        }
      ]
    }
  ]
}
```

**Catatan:**

- Response selalu mengembalikan **semua tanggal** dalam range (termasuk yang kosong, `entries: []`)
- Entry dari event publik memiliki `source: "event"`, sisanya `source: "calendar"`
- Tanpa auth: hanya item `visibility: public` + event publik
- Dengan auth (role internal): + item `visibility: internal` + jadwal pribadi sendiri + item yang di-invite
- Multi-day entry (contoh: festival 3 hari) muncul di **setiap tanggal** yang di-span

---

### 2. Lihat Agenda (Flat List)

Mendapatkan data kalender dalam format flat list dengan pagination. Cocok untuk tampilan agenda/list.

**Endpoint:** `GET /calendar/agenda`

**Authentication:** Public (optional JWT)

**Query Parameters:**

| Param       | Type            | Required | Default | Description                                            |
| ----------- | --------------- | -------- | ------- | ------------------------------------------------------ |
| `startDate` | ISO date string | Ya       | -       | Tanggal mulai range (contoh: `2026-03-01`)             |
| `endDate`   | ISO date string | Ya       | -       | Tanggal akhir range (contoh: `2026-03-31`)             |
| `source`    | string          | Tidak    | -       | Filter: `important_date`, `personal_schedule`, `event` |
| `daerah_id` | UUID            | Tidak    | -       | Filter per daerah                                      |
| `search`    | string          | Tidak    | -       | Pencarian di title dan description                     |
| `page`      | integer         | Tidak    | `1`     | Halaman                                                |
| `limit`     | integer         | Tidak    | `20`    | Jumlah per halaman                                     |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Hari Permainan Rakyat Nasional",
      "description": "Peringatan tahunan permainan rakyat Indonesia",
      "type": "important_date",
      "visibility": "public",
      "start_date": "2026-03-02T00:00:00.000Z",
      "end_date": null,
      "all_day": true,
      "color": "#E74C3C",
      "source": "calendar",
      "daerah_id": null,
      "event_id": null,
      "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "title": "Festival Egrang Jawa Barat",
      "description": "Festival tahunan egrang di Bandung",
      "type": "event",
      "visibility": "public",
      "start_date": "2026-03-05T08:00:00.000Z",
      "end_date": "2026-03-07T17:00:00.000Z",
      "all_day": false,
      "color": null,
      "source": "event",
      "daerah_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "event_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 3. Detail Calendar Item

Mendapatkan detail satu item kalender beserta relasi.

**Endpoint:** `GET /calendar/:id`

**Authentication:** Public (tapi visibility-checked)

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Success Response (200):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Hari Permainan Rakyat Nasional",
  "description": "Peringatan tahunan permainan rakyat Indonesia",
  "type": "important_date",
  "visibility": "public",
  "start_date": "2026-03-02T00:00:00.000Z",
  "end_date": null,
  "all_day": true,
  "color": "#E74C3C",
  "daerah_id": null,
  "event_id": null,
  "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "updated_by": null,
  "created_at": "2026-02-20T10:00:00.000Z",
  "updated_at": "2026-02-20T10:00:00.000Z",
  "daerah": null,
  "creator": {
    "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "full_name": "Admin KPOTI Pusat",
    "email": "admin@kpoti.go.id"
  },
  "invites": []
}
```

**Error Responses:**

```json
// 404 - Item tidak ditemukan
{
  "statusCode": 404,
  "message": "Calendar item with ID a1b2c3d4-... not found",
  "error": "Not Found"
}

// 403 - Tidak punya akses (visibility private/internal)
{
  "statusCode": 403,
  "message": "Authentication required to view this calendar item",
  "error": "Forbidden"
}
```

---

### 4. Buat Tanggal Penting

Membuat tanggal penting baru. Hanya Admin KPOTI dan Kurator Daerah.

**Endpoint:** `POST /calendar/important-dates`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `kurator_daerah`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Hari Permainan Rakyat Nasional",
  "description": "Peringatan tahunan permainan rakyat Indonesia",
  "start_date": "2026-03-02T00:00:00.000Z",
  "end_date": null,
  "all_day": true,
  "color": "#E74C3C",
  "visibility": "public",
  "daerah_id": null
}
```

**Request Body Schema:**

| Field         | Type     | Required | Validation                                                                                       |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `title`       | string   | Ya       | Tidak boleh kosong                                                                               |
| `description` | string   | Tidak    | -                                                                                                |
| `start_date`  | ISO date | Ya       | Harus valid date                                                                                 |
| `end_date`    | ISO date | Tidak    | Harus valid date jika diisi                                                                      |
| `all_day`     | boolean  | Tidak    | Default: `true`                                                                                  |
| `color`       | string   | Tidak    | Hex format: `#RRGGBB` (contoh: `#FF5733`)                                                        |
| `visibility`  | enum     | Ya       | `public` atau `internal` (tidak boleh `private`)                                                 |
| `daerah_id`   | UUID     | Tidak    | Kurator Daerah: otomatis diisi daerah sendiri jika kosong, wajib match daerah sendiri jika diisi |

**Success Response (201):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Hari Permainan Rakyat Nasional",
  "description": "Peringatan tahunan permainan rakyat Indonesia",
  "type": "important_date",
  "visibility": "public",
  "start_date": "2026-03-02T00:00:00.000Z",
  "end_date": null,
  "all_day": true,
  "color": "#E74C3C",
  "daerah_id": null,
  "event_id": null,
  "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "created_at": "2026-02-20T10:00:00.000Z",
  "updated_at": "2026-02-20T10:00:00.000Z"
}
```

**Error Responses:**

```json
// 400 - Visibility tidak valid
{
  "statusCode": 400,
  "message": "Important dates cannot be private. Use personal-schedule instead.",
  "error": "Bad Request"
}

// 400 - daerah_id tidak valid
{
  "statusCode": 400,
  "message": "Invalid daerah_id: c3d4e5f6-...",
  "error": "Bad Request"
}

// 403 - Kurator coba set daerah_id bukan miliknya
{
  "statusCode": 403,
  "message": "Kurator Daerah can only create important dates for their own daerah",
  "error": "Forbidden"
}

// 403 - Role tidak diizinkan
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Catatan:**

- **Admin KPOTI** dapat membuat tanggal penting nasional (tanpa `daerah_id`) atau per daerah
- **Kurator Daerah** hanya bisa membuat tanggal penting untuk daerahnya sendiri. Jika `daerah_id` tidak diisi, otomatis menggunakan `daerah_id` dari profil kurator

---

### 5. Lihat Semua Tanggal Penting (Admin View)

Mendapatkan daftar semua tanggal penting. Kurator hanya melihat tanggal penting daerahnya + tanggal penting nasional.

**Endpoint:** `GET /calendar/important-dates`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `kurator_daerah`

**Query Parameters:**

| Param   | Type | Required | Default | Description      |
| ------- | ---- | -------- | ------- | ---------------- |
| `page`  | int  | Tidak    | `1`     | Nomor halaman    |
| `limit` | int  | Tidak    | `20`    | Item per halaman |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Hari Permainan Rakyat Nasional",
      "description": "Peringatan tahunan",
      "type": "important_date",
      "visibility": "public",
      "start_date": "2026-03-02T00:00:00.000Z",
      "end_date": null,
      "all_day": true,
      "color": "#E74C3C",
      "daerah_id": null,
      "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "created_at": "2026-02-20T10:00:00.000Z",
      "updated_at": "2026-02-20T10:00:00.000Z",
      "daerah": null,
      "creator": {
        "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
        "full_name": "Admin KPOTI Pusat"
      }
    }
  ],
  "pagination": {
    "total": 24,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 6. Update Tanggal Penting

Mengubah data tanggal penting.

**Endpoint:** `PATCH /calendar/important-dates/:id`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `kurator_daerah`

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Request Body:**

```json
{
  "title": "Hari Permainan Rakyat Nasional (Updated)",
  "color": "#9B59B6"
}
```

**Request Body Schema:**

| Field         | Type     | Required | Validation                                 |
| ------------- | -------- | -------- | ------------------------------------------ |
| `title`       | string   | Tidak    | -                                          |
| `description` | string   | Tidak    | -                                          |
| `start_date`  | ISO date | Tidak    | Harus valid date                           |
| `end_date`    | ISO date | Tidak    | Harus valid date                           |
| `all_day`     | boolean  | Tidak    | -                                          |
| `color`       | string   | Tidak    | Hex format `#RRGGBB`                       |
| `visibility`  | enum     | Tidak    | Tidak boleh `private` untuk important_date |
| `daerah_id`   | UUID     | Tidak    | Kurator: harus daerah sendiri              |

**Success Response (200):** Mengembalikan CalendarItem yang sudah diupdate.

**Error Responses:**

```json
// 404 - Item tidak ditemukan
{
  "statusCode": 404,
  "message": "Calendar item with ID ... not found",
  "error": "Not Found"
}

// 403 - Kurator coba edit item daerah lain
{
  "statusCode": 403,
  "message": "You can only edit important dates for your own daerah",
  "error": "Forbidden"
}

// 400 - Coba set private
{
  "statusCode": 400,
  "message": "Important dates cannot be private",
  "error": "Bad Request"
}
```

**Catatan:**

- **Admin KPOTI** bisa edit semua tanggal penting
- **Kurator Daerah** hanya bisa edit tanggal penting yang dibuat sendiri atau yang terkait daerahnya

---

### 7. Hapus Tanggal Penting

Menghapus tanggal penting.

**Endpoint:** `DELETE /calendar/important-dates/:id`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `kurator_daerah`

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Success Response (200):**

```json
{
  "message": "Important date deleted successfully"
}
```

**Error Responses:** Sama dengan update (404, 403).

---

### 8. Buat Jadwal Pribadi

Membuat jadwal pribadi untuk user yang sedang login.

**Endpoint:** `POST /calendar/personal-schedule`

**Authentication:** Required (JWT Token)

**Request Body:**

```json
{
  "title": "Rapat Persiapan Festival",
  "description": "Koordinasi panitia festival egrang",
  "start_date": "2026-03-05T10:00:00.000Z",
  "end_date": "2026-03-05T12:00:00.000Z",
  "all_day": false,
  "color": "#3498DB",
  "visibility": "private"
}
```

**Request Body Schema:**

| Field         | Type     | Required | Validation                                |
| ------------- | -------- | -------- | ----------------------------------------- |
| `title`       | string   | Ya       | Tidak boleh kosong                        |
| `description` | string   | Tidak    | -                                         |
| `start_date`  | ISO date | Ya       | Harus valid date                          |
| `end_date`    | ISO date | Tidak    | Harus valid date jika diisi               |
| `all_day`     | boolean  | Tidak    | Default: `true`                           |
| `color`       | string   | Tidak    | Hex format `#RRGGBB`                      |
| `visibility`  | enum     | Tidak    | Default: `private`. Lihat aturan di bawah |

**Aturan Visibility untuk Jadwal Pribadi:**

| Role             | Visibility yang diizinkan       |
| ---------------- | ------------------------------- |
| `publik`         | `private` saja                  |
| `pakar`          | `private`, `internal`           |
| `kurator_daerah` | `private`, `internal`           |
| `admin_kpoti`    | `private`, `internal`, `public` |

**Success Response (201):**

```json
{
  "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
  "title": "Rapat Persiapan Festival",
  "description": "Koordinasi panitia festival egrang",
  "type": "personal_schedule",
  "visibility": "private",
  "start_date": "2026-03-05T10:00:00.000Z",
  "end_date": "2026-03-05T12:00:00.000Z",
  "all_day": false,
  "color": "#3498DB",
  "daerah_id": null,
  "event_id": null,
  "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "created_at": "2026-02-25T10:00:00.000Z",
  "updated_at": "2026-02-25T10:00:00.000Z"
}
```

**Error Responses:**

```json
// 403 - User publik coba set internal
{
  "statusCode": 403,
  "message": "Public users cannot create internal schedules",
  "error": "Forbidden"
}

// 403 - Non-admin coba set public
{
  "statusCode": 403,
  "message": "Only Admin KPOTI can create public personal schedules",
  "error": "Forbidden"
}
```

---

### 9. Lihat Jadwal Pribadi Saya

Mendapatkan semua jadwal pribadi milik user yang sedang login.

**Endpoint:** `GET /calendar/personal-schedule`

**Authentication:** Required (JWT Token)

**Query Parameters:**

| Param   | Type | Required | Default | Description      |
| ------- | ---- | -------- | ------- | ---------------- |
| `page`  | int  | Tidak    | `1`     | Nomor halaman    |
| `limit` | int  | Tidak    | `20`    | Item per halaman |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
      "title": "Rapat Persiapan Festival",
      "description": "Koordinasi panitia festival egrang",
      "type": "personal_schedule",
      "visibility": "private",
      "start_date": "2026-03-05T10:00:00.000Z",
      "end_date": "2026-03-05T12:00:00.000Z",
      "all_day": false,
      "color": "#3498DB",
      "daerah_id": null,
      "event_id": null,
      "created_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "created_at": "2026-02-25T10:00:00.000Z",
      "updated_at": "2026-02-25T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 10. Update Jadwal Pribadi

Mengubah data jadwal pribadi. Hanya pemilik yang bisa edit.

**Endpoint:** `PATCH /calendar/personal-schedule/:id`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Request Body:**

```json
{
  "title": "Rapat Persiapan Festival (Revisi)",
  "start_date": "2026-03-05T14:00:00.000Z",
  "end_date": "2026-03-05T16:00:00.000Z"
}
```

**Request Body Schema:** Sama dengan Update Tanggal Penting (#6), semua field optional.

**Success Response (200):** Mengembalikan CalendarItem yang sudah diupdate.

**Error Responses:**

```json
// 403 - Bukan pemilik
{
  "statusCode": 403,
  "message": "You can only edit your own personal schedule",
  "error": "Forbidden"
}
```

---

### 11. Hapus Jadwal Pribadi

Menghapus jadwal pribadi. Hanya pemilik yang bisa hapus.

**Endpoint:** `DELETE /calendar/personal-schedule/:id`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Success Response (200):**

```json
{
  "message": "Personal schedule deleted successfully"
}
```

---

### 12. Undang User ke Calendar Item

Mengundang satu atau beberapa user untuk melihat calendar item. Hanya pembuat item yang bisa mengundang. Tidak bisa digunakan untuk item `public`.

**Endpoint:** `POST /calendar/:id/invites`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Request Body:**

Gunakan `user_ids`, `emails`, atau keduanya. Setidaknya satu harus diisi.

```json
{
  "user_ids": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
  "emails": ["pakar2@example.com", "kurator.jatim@example.com"]
}
```

**Request Body Schema:**

| Field      | Type     | Required | Validation                                    |
| ---------- | -------- | -------- | --------------------------------------------- |
| `user_ids` | UUID[]   | Tidak\*  | Array of valid UUID v4; min 1 item jika diisi |
| `emails`   | string[] | Tidak\*  | Array of valid email; min 1 item jika diisi   |

\* Minimal **satu** dari `user_ids` atau `emails` harus diisi.

> **Note:** Email yang tidak ditemukan di database akan menghasilkan error `400` dengan daftar email tidak valid.

**Success Response (201):**

```json
[
  {
    "id": "e5f6a7b8-c9d0-1234-efgh-345678901234",
    "calendar_item_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "invited_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "created_at": "2026-02-25T10:00:00.000Z",
    "updated_at": "2026-02-25T10:00:00.000Z"
  },
  {
    "id": "f6a7b8c9-d0e1-2345-fghi-456789012345",
    "calendar_item_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
    "user_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "status": "pending",
    "invited_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "created_at": "2026-02-25T10:00:00.000Z",
    "updated_at": "2026-02-25T10:00:00.000Z"
  }
]
```

**Error Responses:**

```json
// 403 - Bukan pembuat item
{
  "statusCode": 403,
  "message": "Only the creator of a calendar item can invite users",
  "error": "Forbidden"
}

// 400 - Item public tidak perlu invite
{
  "statusCode": 400,
  "message": "Public calendar items do not need invites — they are visible to everyone",
  "error": "Bad Request"
}

// 400 - Tidak ada user valid untuk diundang
{
  "statusCode": 400,
  "message": "No valid users to invite",
  "error": "Bad Request"
}

// 400 - Tidak ada user_ids maupun emails
{
  "statusCode": 400,
  "message": "Provide at least one user_id or email to invite",
  "error": "Bad Request"
}

// 400 - Email tidak terdaftar
{
  "statusCode": 400,
  "message": "The following emails are not registered: unknown@example.com",
  "error": "Bad Request"
}
```

**Catatan:**

- Bisa mengundang via `user_ids`, `emails`, atau kombinasi keduanya
- Email yang tidak terdaftar di platform akan menghasilkan error — pastikan email valid sebelum submit
- User yang sudah diundang sebelumnya akan di-skip (tidak duplikat)
- Tidak bisa mengundang diri sendiri (otomatis difilter)
- Response berisi semua invites (termasuk yang sudah ada sebelumnya)

---

### 13. Lihat Undangan untuk Calendar Item

Melihat daftar semua user yang diundang ke calendar item tertentu. Hanya pembuat item.

**Endpoint:** `GET /calendar/:id/invites`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param | Type | Required | Description      |
| ----- | ---- | -------- | ---------------- |
| `id`  | UUID | Ya       | ID calendar item |

**Query Parameters:**

| Param    | Type | Required | Default | Description                                      |
| -------- | ---- | -------- | ------- | ------------------------------------------------ |
| `page`   | int  | Tidak    | `1`     | Nomor halaman                                    |
| `limit`  | int  | Tidak    | `20`    | Item per halaman                                 |
| `status` | enum | Tidak    | (semua) | Filter status: `pending`, `accepted`, `declined` |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "e5f6a7b8-c9d0-1234-efgh-345678901234",
      "calendar_item_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "accepted",
      "invited_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "created_at": "2026-02-25T10:00:00.000Z",
      "updated_at": "2026-02-25T11:00:00.000Z",
      "user": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "full_name": "Pakar Budaya 1",
        "email": "pakar1@example.com"
      }
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 14. Hapus Undangan

Menghapus undangan user dari calendar item. Hanya pembuat item.

**Endpoint:** `DELETE /calendar/:id/invites/:userId`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param    | Type | Required | Description                            |
| -------- | ---- | -------- | -------------------------------------- |
| `id`     | UUID | Ya       | ID calendar item                       |
| `userId` | UUID | Ya       | ID user yang ingin dihapus undangannya |

**Success Response (200):**

```json
{
  "message": "Invite removed successfully"
}
```

**Error Responses:**

```json
// 403 - Bukan pembuat
{
  "statusCode": 403,
  "message": "Only the creator can remove invites",
  "error": "Forbidden"
}

// 404 - Invite tidak ditemukan
{
  "statusCode": 404,
  "message": "Invite not found",
  "error": "Not Found"
}
```

---

### 15. Lihat Undangan Saya

Mendapatkan semua undangan kalender yang ditujukan ke user yang sedang login.

**Endpoint:** `GET /calendar/invites/my`

**Authentication:** Required (JWT Token)

**Query Parameters:**

| Param    | Type | Required | Default | Description                                      |
| -------- | ---- | -------- | ------- | ------------------------------------------------ |
| `page`   | int  | Tidak    | `1`     | Nomor halaman                                    |
| `limit`  | int  | Tidak    | `20`    | Item per halaman                                 |
| `status` | enum | Tidak    | (semua) | Filter status: `pending`, `accepted`, `declined` |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "e5f6a7b8-c9d0-1234-efgh-345678901234",
      "calendar_item_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "pending",
      "invited_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "created_at": "2026-02-25T10:00:00.000Z",
      "updated_at": "2026-02-25T10:00:00.000Z",
      "calendarItem": {
        "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
        "title": "Rapat Persiapan Festival",
        "type": "personal_schedule",
        "visibility": "private",
        "start_date": "2026-03-05T10:00:00.000Z",
        "end_date": "2026-03-05T12:00:00.000Z",
        "all_day": false,
        "creator": {
          "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
          "full_name": "Kurator Bandung"
        }
      },
      "invitedByUser": {
        "id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
        "full_name": "Kurator Bandung"
      }
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 16. Respon Undangan (Accept/Decline)

Menerima atau menolak undangan kalender.

**Endpoint:** `PATCH /calendar/invites/:inviteId`

**Authentication:** Required (JWT Token)

**URL Parameters:**

| Param      | Type | Required | Description |
| ---------- | ---- | -------- | ----------- |
| `inviteId` | UUID | Ya       | ID invite   |

**Request Body:**

```json
{
  "status": "accepted"
}
```

**Request Body Schema:**

| Field    | Type | Required | Validation                                         |
| -------- | ---- | -------- | -------------------------------------------------- |
| `status` | enum | Ya       | `accepted` atau `declined` (tidak boleh `pending`) |

**Success Response (200):**

```json
{
  "id": "e5f6a7b8-c9d0-1234-efgh-345678901234",
  "calendar_item_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "accepted",
  "invited_by": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "created_at": "2026-02-25T10:00:00.000Z",
  "updated_at": "2026-02-25T11:30:00.000Z"
}
```

**Error Responses:**

```json
// 403 - Bukan penerima undangan
{
  "statusCode": 403,
  "message": "You can only update your own invites",
  "error": "Forbidden"
}

// 400 - Coba set kembali ke pending
{
  "statusCode": 400,
  "message": "Cannot set status back to pending",
  "error": "Bad Request"
}
```

---

## Permissions

### Role × Action Matrix

| Action                    | `publik`              | `pakar`               | `kurator_daerah`      | `admin_kpoti`         | Unauthenticated |
| ------------------------- | --------------------- | --------------------- | --------------------- | --------------------- | --------------- |
| Lihat kalender (public)   | ✅                    | ✅                    | ✅                    | ✅                    | ✅              |
| Lihat kalender (internal) | ❌                    | ✅                    | ✅                    | ✅                    | ❌              |
| Lihat kalender (private)  | Milik sendiri/invited | Milik sendiri/invited | Milik sendiri/invited | Milik sendiri/invited | ❌              |
| Buat tanggal penting      | ❌                    | ❌                    | ✅ (daerah sendiri)   | ✅ (semua)            | ❌              |
| Edit tanggal penting      | ❌                    | ❌                    | ✅ (daerah sendiri)   | ✅ (semua)            | ❌              |
| Hapus tanggal penting     | ❌                    | ❌                    | ✅ (daerah sendiri)   | ✅ (semua)            | ❌              |
| Buat jadwal pribadi       | ✅ (private saja)     | ✅ (private/internal) | ✅ (private/internal) | ✅ (semua visibility) | ❌              |
| Edit jadwal pribadi       | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (semua)            | ❌              |
| Hapus jadwal pribadi      | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (semua)            | ❌              |
| Undang user               | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ✅ (milik sendiri)    | ❌              |
| Respon undangan           | ✅                    | ✅                    | ✅                    | ✅                    | ❌              |

---

## Common Use Cases

### 1. Menampilkan Kalender Bulanan (Public)

```javascript
// Tampilkan kalender Maret 2026 untuk pengunjung
const response = await fetch('/api/calendar?year=2026&month=3&view=monthly');
const calendar = await response.json();

// calendar.items = array of { date, entries }
calendar.items.forEach((day) => {
  console.log(`${day.date}: ${day.entries.length} item(s)`);
  day.entries.forEach((entry) => {
    // Tampilkan di UI kalender
    console.log(`  - [${entry.type}] ${entry.title} (${entry.source})`);
  });
});
```

### 2. Menampilkan Kalender Mingguan (Authenticated Internal)

```javascript
// Tampilkan minggu ke-2 bulan Maret 2026 untuk user internal
const response = await fetch(
  '/api/calendar?year=2026&month=3&view=weekly&week=2',
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
const calendar = await response.json();
// User internal akan melihat: public + internal + private milik sendiri + invited
```

### 3. Alur Admin Membuat Tanggal Penting Nasional

```javascript
// Step 1: Admin buat tanggal penting
const importantDate = await fetch('/api/calendar/important-dates', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Hari Permainan Rakyat Nasional',
    description: 'Peringatan tahunan permainan rakyat Indonesia',
    start_date: '2026-03-02T00:00:00.000Z',
    all_day: true,
    color: '#E74C3C',
    visibility: 'public', // Semua orang bisa lihat
  }),
});

// Step 2: Verifikasi muncul di kalender publik
const calendar = await fetch('/api/calendar?year=2026&month=3');
// Tanggal 2 Maret akan ada entry "Hari Permainan Rakyat Nasional"
```

### 4. Alur User Membuat dan Membagikan Jadwal Pribadi

```javascript
// Step 1: User buat jadwal pribadi
const schedule = await fetch('/api/calendar/personal-schedule', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Rapat Koordinasi Tim',
    description: 'Pembahasan progress festival',
    start_date: '2026-03-10T10:00:00.000Z',
    end_date: '2026-03-10T12:00:00.000Z',
    all_day: false,
    color: '#3498DB',
    visibility: 'private',
  }),
});
const scheduleData = await schedule.json();

// Step 2: Undang rekan tim
await fetch(`/api/calendar/${scheduleData.id}/invites`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    user_ids: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    ],
  }),
});

// Step 3: Cek siapa saja yang sudah diundang
const invites = await fetch(`/api/calendar/${scheduleData.id}/invites`, {
  headers: { Authorization: `Bearer ${userToken}` },
});
```

### 5. Alur User Menerima Undangan

```javascript
// Step 1: Cek undangan saya
const response = await fetch('/api/calendar/invites/my', {
  headers: { Authorization: `Bearer ${userToken}` },
});
const invites = await response.json();

// Step 2: Terima undangan
const pendingInvite = invites.find((i) => i.status === 'pending');
if (pendingInvite) {
  await fetch(`/api/calendar/invites/${pendingInvite.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'accepted' }),
  });
}

// Setelah diterima, item akan muncul di kalender user tersebut
```

### 6. Filter Kalender: Hanya Event Publik

```javascript
// Hanya tampilkan event dari modul Events (bukan tanggal penting/jadwal pribadi)
const response = await fetch('/api/calendar?year=2026&month=3&source=event');
const calendar = await response.json();
// Semua entry akan memiliki type: "event" dan source: "event"
```

### 7. Filter Kalender per Daerah

```javascript
// Tampilkan kalender untuk daerah tertentu
const daerahId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const response = await fetch(
  `/api/calendar?year=2026&month=3&daerah_id=${daerahId}`,
);
// Hanya menampilkan: tanggal penting daerah tersebut + event di daerah tersebut
```

### 8. Menggunakan Agenda View dengan Pagination

```javascript
// Tampilkan semua item bulan Maret sebagai flat list
const response = await fetch(
  '/api/calendar/agenda?startDate=2026-03-01&endDate=2026-03-31&page=1&limit=10',
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
const agenda = await response.json();

agenda.data.forEach((entry) => {
  console.log(`${entry.start_date} - ${entry.title} [${entry.type}]`);
});

console.log(
  `Page ${agenda.pagination.page} of ${agenda.pagination.totalPages}`,
);
```

---

## Error Codes

| Status Code | Description                                               |
| ----------- | --------------------------------------------------------- |
| `200`       | Request berhasil                                          |
| `201`       | Item berhasil dibuat                                      |
| `400`       | Bad Request — validasi gagal, visibility tidak valid, dsb |
| `401`       | Unauthorized — token tidak valid atau tidak ada           |
| `403`       | Forbidden — role tidak diizinkan atau bukan pemilik       |
| `404`       | Not Found — item atau invite tidak ditemukan              |
| `429`       | Too Many Requests — rate limit terlampaui                 |

---

## Notes

- **Event Integration**: Event publik (`published`, `ongoing`, `completed`) dari modul Events otomatis ditampilkan di kalender. Tidak perlu membuat calendar item terpisah untuk event — cukup gunakan parameter `include_events=true` (default).
- **Multi-day Spanning**: Item yang berlangsung lebih dari satu hari (contoh: festival 3 hari) akan muncul di setiap tanggal yang di-span dalam monthly/weekly view.
- **Empty Days**: Monthly dan weekly view selalu mengembalikan semua tanggal dalam range, termasuk yang tidak ada entry (`entries: []`). Ini memudahkan frontend untuk render grid kalender.
- **Color Format**: Warna menggunakan format hex 6 digit (`#RRGGBB`). Gunakan warna yang konsisten untuk membedakan tipe item di UI kalender.
- **Invite System**: Hanya untuk item `internal` dan `private`. Item `public` tidak perlu invite karena sudah visible ke semua orang.
- **Kurator Daerah Auto-fill**: Saat kurator daerah membuat tanggal penting tanpa mengisi `daerah_id`, sistem otomatis menggunakan `daerah_id` dari profil kurator tersebut.
- **Sorting**: Semua response terurut berdasarkan `start_date` ascending.
- **Search**: Parameter `search` melakukan pencarian ILIKE (case-insensitive) pada `title` dan `description` untuk calendar items, serta pada `nama` dan `deskripsi` untuk events.
