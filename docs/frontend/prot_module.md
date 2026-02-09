# PROT Module Documentation

## Overview
PROT (Permainan Rakyat dan Olahraga Tradisional) module menangani data permainan rakyat dan olahraga tradisional Indonesia. Module ini menyediakan endpoint untuk CRUD data PROT, upload foto/video kegiatan, filter berdasarkan lokasi dan kategori, serta sistem verifikasi workflow 4 tahap.

## Base URL
```
/prot
/verifikasi
```

---

## Data Model

### PROT Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| nama | string | Yes | Nama permainan/olahraga |
| jenis | enum | Yes | `PERMAINAN_RAKYAT`, `OLAHRAGA_TRADISIONAL` |
| status | enum | Auto | `DRAFT`, `DIKURASI`, `REVISI`, `DIVERIFIKASI`, `ARSIP_NASIONAL` (default: DRAFT) |
| statusAsalUsul | text | No | Sejarah/asal usul permainan |
| provinsiKode | string | No | Kode provinsi (cascade validation) |
| kabkotaKode | string | No | Kode kabupaten/kota (requires provinsiKode) |
| kecamatanKode | string | No | Kode kecamatan (requires kabkotaKode) |
| desaKode | string | No | Kode desa (requires kecamatanKode) |
| alamatLengkap | string | No | Alamat lengkap lokasi |
| caraBermain | text | No | Cara memainkan |
| nilaiMoral | text | No | Nilai moral/pendidikan |
| targetUsia | enum | Yes | `ANAK`, `REMAJA`, `DEWASA`, `SEMUA_USIA` |
| peralatan | jsonb | No | Array of equipment data |
| fotoKegiatan | jsonb | No | Array of photo URLs |
| videoKegiatan | jsonb | No | Array of video URLs |
| created_by | UUID | Auto | User ID yang created |
| verified_by | UUID | No | User ID (pakar) yang verified |
| published_by | UUID | No | User ID (admin) yang published |
| submitted_at | timestamp | No | Tanggal submit untuk verifikasi |
| verified_at | timestamp | No | Tanggal verifikasi selesai |
| published_at | timestamp | No | Tanggal publish ke arsip nasional |
| created_at | timestamp | Auto | Tanggal dibuat |
| updated_at | timestamp | Auto | Tanggal diupdate |

### PROTStatus Enum

| Value | Description |
|-------|-------------|
| `DRAFT` | Kurator sedang mengerjakan (belum di-submit) |
| `DIKURASI` | Sudah di-submit, menunggu verifikasi pakar |
| `REVISI` | Pakar minta perbaikan, kurator sedang revisi |
| `DIVERIFIKASI` | Sudah di-approve pakar, menunggu publish admin |
| `ARSIP_NASIONAL` | Sudah dipublish, tampil ke publik |

### Status Flow

```
[DRAFT] ──submit──▶ [DIKURASI] ──pick & review──┐
  ▲                                              │
  │                          ┌───────────────────┤
  │                          ▼                   ▼
  │                     [REJECTED]      [REVISION_NEEDED]
  │                     (→ DRAFT)              │
  │                                            ▼
  │                                        [REVISI]
  │                                            │
  │                                       re-submit
  │                                            │
  │                                            ▼
  │                                        [DIKURASI]
  │
  │      APPROVED
  │         │
  │         ▼
  │  [DIVERIFIKASI] ──publish──▶ [ARSIP_NASIONAL]
```

### PROTJenis Enum

| Value | Description |
|-------|-------------|
| `PERMAINAN_RAKYAT` | Permainan rakyat tradisional |
| `OLAHRAGA_TRADISIONAL` | Olahraga tradisional |

### TargetUsia Enum

| Value | Description |
|-------|-------------|
| `ANAK` | Untuk anak-anak |
| `REMAJA` | Untuk remaja |
| `DEWASA` | Untuk dewasa |
| `SEMUA_USIA` | Untuk semua usia |

### Peralatan Interface (jsonb)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| nama | string | Yes | Nama peralatan |
| deskripsi | string | No | Deskripsi peralatan |
| kisaranHarga | string | No | Kisaran harga |
| fotoAlat | string[] | No | Array of photo URLs |

### Verifikasi Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| prot_id | UUID | ID PROT yang diverifikasi |
| pakar_id | UUID | ID pakar yang mereview |
| status | enum | `PENDING`, `APPROVED`, `REJECTED`, `REVISION_NEEDED` |
| catatan | text | Catatan dari pakar |
| saran_perbaikan | text | Saran perbaikan (required jika REVISION_NEEDED) |
| dokumen_pendukung | jsonb | Array document URLs |
| verified_at | timestamp | Tanggal verifikasi |
| created_at | timestamp | Tanggal dibuat |
| updated_at | timestamp | Tanggal diupdate |

### VerifikasiQueue Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| prot_id | UUID | ID PROT (unique) |
| assigned_pakar_id | UUID | ID pakar yang mengambil (nullable) |
| priority | integer | Priority queue (default: 0) |
| assigned_at | timestamp | Tanggal di-assign pakar |
| created_at | timestamp | Tanggal dibuat |
| updated_at | timestamp | Tanggal diupdate |

---

## Endpoints

### 1. Create PROT

Membuat data PROT baru dengan status DRAFT.

**Endpoint:** `POST /prot`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**Request Body:**

```typescript
{
  nama: string;                    // Required, min 3 chars
  jenis: 'PERMAINAN_RAKYAT' | 'OLAHRAGA_TRADISIONAL';  // Required
  statusAsalUsul?: string;         // Optional
  provinsiKode?: string;           // Optional, required if kabkotaKode exists
  kabkotaKode?: string;            // Optional, required if kecamatanKode exists
  kecamatanKode?: string;          // Optional, required if desaKode exists
  desaKode?: string;               // Optional
  alamatLengkap?: string;          // Optional
  caraBermain?: string;            // Optional
  nilaiMoral?: string;             // Optional
  targetUsia: 'ANAK' | 'REMAJA' | 'DEWASA' | 'SEMUA_USIA';  // Required
  peralatan?: Array<{              // Optional
    nama: string;
    deskripsi?: string;
    kisaranHarga?: string;
    fotoAlat?: string[];
  }>;
  fotoKegiatan?: string[];         // Optional, array of URLs
  videoKegiatan?: string[];        // Optional, array of URLs
}
```

**Request Example:**
```json
POST /prot
Authorization: Bearer <token>
Content-Type: application/json

{
  "nama": "Gasing",
  "jenis": "PERMAINAN_RAKYAT",
  "statusAsalUsul": "Permainan tradisional yang sudah ada sejak zaman kerajaan di Indonesia",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "targetUsia": "ANAK",
  "caraBermain": "Gasing diputar menggunakan tali yang dililitkan pada bagian badan gasing",
  "nilaiMoral": "Melatih kesabaran, ketelitian, dan motorik halus anak",
  "peralatan": [
    {
      "nama": "Gasing",
      "deskripsi": "Gasing kayu dengan paku di bagian bawah",
      "kisaranHarga": "10.000 - 50.000"
    }
  ]
}
```

**Success Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing",
  "jenis": "PERMAINAN_RAKYAT",
  "status": "DRAFT",
  "statusAsalUsul": "Permainan tradisional yang sudah ada sejak zaman kerajaan di Indonesia",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "targetUsia": "ANAK",
  "created_by": "user-uuid",
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T10:00:00.000Z"
}
```

---

### 2. List All PROT

Mengambil semua data PROT dengan pagination dan filter. **Role-based filtering applies:**
- Public/PUBLIK: Hanya lihat `ARSIP_NASIONAL`
- KURATOR_DAERAH: Lihat PROT sendiri (semua status) + `ARSIP_NASIONAL`
- PAKAR: Lihat `DIKURASI` + `ARSIP_NASIONAL`
- ADMIN_KPOTI: Lihat semua

**Endpoint:** `GET /prot`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |
| jenis | enum | No | - | Filter by jenis |
| provinsi | string | No | - | Filter by kode provinsi |
| kabkota | string | No | - | Filter by kode kabupaten/kota |
| kecamatan | string | No | - | Filter by kode kecamatan |
| desa | string | No | - | Filter by kode desa |
| targetUsia | enum | No | - | Filter by target usia |
| search | string | No | - | Search by nama |
| status | enum | No | - | Filter by status: `DRAFT`, `DIKURASI`, `REVISI`, `DIVERIFIKASI`, `ARSIP_NASIONAL` |
| created_by | string (UUID) | No | - | Filter by creator UUID |

**Request Examples:**
```
GET /prot?page=1&limit=20
GET /prot?jenis=PERMAINAN_RAKYAT
GET /prot?status=ARSIP_NASIONAL
GET /prot?created_by=user-uuid
```

---

### 3. Get PROT by ID

Mengambil data PROT spesifik berdasarkan ID.

**Endpoint:** `GET /prot/:id`

**Authentication:** Public (tidak memerlukan token)

---

### 4. Update PROT

Update data PROT (partial update). **Hanya bisa edit PROT dengan status DRAFT atau REVISI.** Kurator hanya bisa edit PROT sendiri.

**Endpoint:** `PATCH /prot/:id`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

---

### 5. Delete PROT

Menghapus data PROT.

**Endpoint:** `DELETE /prot/:id`

**Authentication:** Required (Role: `admin_kpoti` only)

---

### 6. Upload Foto Kegiatan

Upload foto kegiatan untuk PROT tertentu.

**Endpoint:** `POST /prot/:id/foto-kegiatan`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

---

### 7. Upload Video Kegiatan

Upload video kegiatan untuk PROT tertentu.

**Endpoint:** `POST /prot/:id/video-kegiatan`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

---

### 8. Delete Foto Kegiatan

Menghapus foto kegiatan berdasarkan index.

**Endpoint:** `DELETE /prot/:id/foto-kegiatan/:index`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

---

### 9. Delete Video Kegiatan

Menghapus video kegiatan berdasarkan index.

**Endpoint:** `DELETE /prot/:id/video-kegiatan/:index`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

---

## Verification Workflow Endpoints

### 10. Submit PROT for Verification (Kurasi)

Submit PROT untuk verifikasi. Status berubah dari `DRAFT` ke `DIKURASI` dan masuk queue verifikasi.

**Endpoint:** `POST /prot/:id/submit-kurasi`

**Authentication:** Required (Role: `kurator_daerah`)

**Request Body:**
```json
{
  "catatan": "Silakan verifikasi PROT ini"
}
```

**Success Response (200 OK):**
```json
{
  "id": "prot-uuid",
  "status": "DIKURASI",
  "submitted_at": "2024-02-09T10:00:00.000Z"
}
```

**Error Responses:**
- `403` - Not the owner of this PROT
- `400` - PROT is not in DRAFT status

---

### 11. Resubmit After Revision

Resubmit PROT setelah selesai revisi. Status berubah dari `REVISI` ke `DIKURASI` dan kembali masuk queue.

**Endpoint:** `POST /prot/:id/resubmit`

**Authentication:** Required (Role: `kurator_daerah`)

**Success Response (200 OK):**
```json
{
  "id": "prot-uuid",
  "status": "DIKURASI",
  "submitted_at": "2024-02-09T11:00:00.000Z"
}
```

---

### 12. Get Available Queue (Pakar)

Melihat PROT yang tersedia untuk verifikasi (belum di-assign).

**Endpoint:** `GET /verifikasi/queue`

**Authentication:** Required (Role: `pakar`)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "queue-uuid",
      "prot": {
        "id": "prot-uuid",
        "nama": "Gasing",
        "status": "DIKURASI",
        "createdBy": {
          "id": "user-uuid",
          "full_name": "Kurator Name"
        }
      },
      "priority": 0,
      "created_at": "2024-02-09T10:00:00.000Z"
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

### 13. Get My Queue (Pakar)

Melihat PROT yang sudah di-assign ke diri sendiri.

**Endpoint:** `GET /verifikasi/my-queue`

**Authentication:** Required (Role: `pakar`)

**Query Parameters:** Same as above

---

### 14. Pick PROT from Queue (Pakar)

Mengambil PROT dari queue untuk diverifikasi.

**Endpoint:** `POST /verifikasi/queue/:queueId/pick`

**Authentication:** Required (Role: `pakar`)

**Success Response (200 OK):**
```json
{
  "id": "queue-uuid",
  "assigned_pakar_id": "pakar-uuid",
  "assigned_at": "2024-02-09T10:30:00.000Z"
}
```

**Error Responses:**
- `404` - Queue item not found
- `400` - Already assigned to another pakar

---

### 15. Release Assigned PROT (Pakar)

Melepas PROT yang sudah di-assign kembali ke queue.

**Endpoint:** `POST /verifikasi/queue/:queueId/release`

**Authentication:** Required (Role: `pakar`)

**Success Response (200 OK):**
```json
{
  "id": "queue-uuid",
  "assigned_pakar_id": null,
  "assigned_at": null
}
```

---

### 16. Submit Review (Pakar)

Submit review hasil verifikasi.

**Endpoint:** `POST /verifikasi/:protId/review`

**Authentication:** Required (Role: `pakar`)

**Request Body:**
```json
{
  "status": "APPROVED",
  "catatan": "Dokumentasi lengkap dan akurat",
  "saran_perbaikan": "Required jika status REVISION_NEEDED",
  "dokumen_pendukung": ["https://example.com/reference.pdf"]
}
```

**Status Options:**
- `APPROVED` - PROT status → `DIVERIFIKASI`
- `REJECTED` - PROT status → `DRAFT`
- `REVISION_NEEDED` - PROT status → `REVISI` (wajib isi `saran_perbaikan`)

**Success Response (201 Created):**
```json
{
  "id": "verifikasi-uuid",
  "prot_id": "prot-uuid",
  "pakar_id": "pakar-uuid",
  "status": "APPROVED",
  "catatan": "Dokumentasi lengkap",
  "verified_at": "2024-02-09T11:00:00.000Z"
}
```

---

### 17. Get Verification History

Melihat history verifikasi sebuah PROT.

**Endpoint:** `GET /verifikasi/:protId/history`

**Authentication:** Required (Role: `pakar`, `admin_kpoti`, `kurator_daerah`)

**Success Response (200 OK):**
```json
[
  {
    "id": "verifikasi-uuid",
    "status": "REVISION_NEEDED",
    "catatan": "Perlu dilengkapi",
    "saran_perbaikan": "Tambahkan referensi",
    "pakar": {
      "id": "pakar-uuid",
      "full_name": "Pakar Name"
    },
    "verified_at": "2024-02-09T10:00:00.000Z"
  }
]
```

---

### 18. Publish to National Archive (Admin)

Publish PROT ke arsip nasional. Status berubah dari `DIVERIFIKASI` ke `ARSIP_NASIONAL`.

**Endpoint:** `POST /verifikasi/prot/:protId/publish`

**Authentication:** Required (Role: `admin_kpoti`)

**Request Body:**
```json
{
  "catatan": "Dipublikasikan ke arsip nasional"
}
```

**Success Response (200 OK):**
```json
{
  "id": "prot-uuid",
  "status": "ARSIP_NASIONAL",
  "published_by": "admin-uuid",
  "published_at": "2024-02-09T12:00:00.000Z"
}
```

---

### 19. Get Verification Statistics (Admin)

Melihat statistik verifikasi.

**Endpoint:** `GET /verifikasi/stats`

**Authentication:** Required (Role: `admin_kpoti`)

**Success Response (200 OK):**
```json
{
  "queue": {
    "totalPending": 15
  },
  "verifikasi": {
    "totalApproved": 120,
    "totalRejected": 8,
    "totalRevision": 22,
    "total": 150
  },
  "protByStatus": {
    "DRAFT": 25,
    "DIKURASI": 15,
    "REVISI": 12,
    "DIVERIFIKASI": 18,
    "ARSIP_NASIONAL": 120
  }
}
```

---

## Daerah Cascade Validation

PROT module menggunakan cascade validation untuk lokasi:

```
provinsi (required if kabkota exists)
  └── kabkota (required if kecamatan exists)
      └── kecamatan (required if desa exists)
          └── desa
```

**Rules:**
1. Jika `desaKode` diberikan, `kecamatanKode` wajib ada
2. Jika `kecamatanKode` diberikan, `kabkotaKode` wajib ada
3. Jika `kabkotaKode` diberikan, `provinsiKode` wajib ada
4. Semua kode daerah akan divalidasi ke DaerahService

---

## Role-Based Access Control

### Public (PUBLIK)
- View: Hanya PROT dengan status `ARSIP_NASIONAL`

### Kurator Daerah (KURATOR_DAERAH)
- Create: PROT (status = DRAFT)
- Edit: PROT sendiri (hanya status DRAFT atau REVISI)
- Submit: PROT untuk verifikasi (DRAFT → DIKURASI)
- Resubmit: Setelah revisi (REVISI → DIKURASI)
- View: PROT sendiri (semua status) + ARSIP_NASIONAL

### Pakar (PAKAR)
- View: Queue verifikasi (DIKURASI) + ARSIP_NASIONAL
- Pick: PROT dari queue
- Release: PROT kembali ke queue
- Review: APPROVE, REJECT, atau REVISION_NEEDED
- View: History verifikasi

### Admin KPOTI (ADMIN_KPOTI)
- All Kurator permissions
- Publish: PROT (DIVERIFIKASI → ARSIP_NASIONAL)
- View: Semua PROT (semua status)
- Delete: PROT
- View: Statistik verifikasi

---

## Common Use Cases

### 1. Kurator Workflow

```typescript
// 1. Create PROT (DRAFT)
POST /prot
{ nama: "Gasing", ... }

// 2. Upload photos
POST /prot/:id/foto-kegiatan
[files]

// 3. Submit for verification
POST /prot/:id/submit-kurasi

// 4. If revision needed, update and resubmit
PATCH /prot/:id { ... }
POST /prot/:id/resubmit
```

### 2. Pakar Workflow

```typescript
// 1. View available queue
GET /verifikasi/queue

// 2. Pick a PROT
POST /verifikasi/queue/:queueId/pick

// 3. Submit review
POST /verifikasi/:protId/review
{ status: "APPROVED", catatan: "..." }

// OR release back to queue
POST /verifikasi/queue/:queueId/release
```

### 3. Admin Workflow

```typescript
// 1. View statistics
GET /verifikasi/stats

// 2. Publish verified PROT
POST /verifikasi/prot/:protId/publish
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error, invalid state transition) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions, not owner) |
| 404 | Not Found (PROT/queue not found) |
| 413 | Payload Too Large (file > 100MB) |
| 415 | Unsupported Media Type (invalid file type) |
| 500 | Internal Server Error |

---

## Migration Notes

After implementing the verification system, run the migration:

```bash
npm run migration:run
```

To rollback:
```bash
npm run migration:revert
```
