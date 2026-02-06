# PROT Module Documentation

## Overview
PROT (Permainan Rakyat dan Olahraga Tradisional) module menangani data permainan rakyat dan olahraga tradisional Indonesia. Module ini menyediakan endpoint untuk CRUD data PROT, upload foto/video kegiatan, dan filter berdasarkan lokasi dan kategori.

## Base URL
```
/prot
```

---

## Data Model

### PROT Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| nama | string | Yes | Nama permainan/olahraga |
| jenis | enum | Yes | `PERMAINAN_RAKYAT`, `OLAHRAGA_TRADISIONAL` |
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
| created_at | timestamp | Auto | Tanggal dibuat |
| updated_at | timestamp | Auto | Tanggal diupdate |

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

---

## Endpoints

### 1. Create PROT

Membuat data PROT baru.

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
  "statusAsalUsul": "Permainan tradisional yang sudah ada sejak zaman kerajaan di Indonesia",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "kecamatanKode": null,
  "desaKode": null,
  "alamatLengkap": null,
  "caraBermain": "Gasing diputar menggunakan tali yang dililitkan pada bagian badan gasing",
  "nilaiMoral": "Melatih kesabaran, ketelitian, dan motorik halus anak",
  "targetUsia": "ANAK",
  "peralatan": [
    {
      "nama": "Gasing",
      "deskripsi": "Gasing kayu dengan paku di bagian bawah",
      "kisaranHarga": "10.000 - 50.000",
      "fotoAlat": null
    }
  ],
  "fotoKegiatan": [],
  "videoKegiatan": [],
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T10:00:00.000Z"
}
```

**Error Responses:**

**400 Bad Request** (Validation error):
```json
{
  "statusCode": 400,
  "message": [
    "nama should not be empty",
    "provinsiKode is required when kabkotaKode is provided",
    "Invalid kabkotaKode: 11.01"
  ],
  "error": "Bad Request"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** (Wrong role):
```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions"
}
```

---

### 2. List All PROT

Mengambil semua data PROT dengan pagination dan filter.

**Endpoint:** `GET /prot`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |
| jenis | enum | No | - | Filter by jenis: `PERMAINAN_RAKYAT`, `OLAHRAGA_TRADISIONAL` |
| provinsi | string | No | - | Filter by kode provinsi |
| kabkota | string | No | - | Filter by kode kabupaten/kota |
| kecamatan | string | No | - | Filter by kode kecamatan |
| desa | string | No | - | Filter by kode desa |
| targetUsia | enum | No | - | Filter by target usia |
| search | string | No | - | Search by nama (case-insensitive, partial match) |

**Request Examples:**
```
GET /prot?page=1&limit=20
GET /prot?jenis=PERMAINAN_RAKYAT
GET /prot?provinsi=11&targetUsia=ANAK
GET /prot?search=gasing
GET /prot?page=1&limit=50&jenis=PERMAINAN_RAKYAT&provinsi=32
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nama": "Gasing",
      "jenis": "PERMAINAN_RAKYAT",
      "statusAsalUsul": "Permainan tradisional...",
      "provinsiKode": "11",
      "kabkotaKode": "11.01",
      "kecamatanKode": null,
      "desaKode": null,
      "alamatLengkap": null,
      "caraBermain": "Gasing diputar...",
      "nilaiMoral": "Melatih kesabaran...",
      "targetUsia": "ANAK",
      "peralatan": [...],
      "fotoKegiatan": [],
      "videoKegiatan": [],
      "created_at": "2024-02-06T10:00:00.000Z",
      "updated_at": "2024-02-06T10:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "nama": "Egrang",
      "jenis": "PERMAINAN_RAKYAT",
      "statusAsalUsul": "Permainan...",
      "provinsiKode": "32",
      "kabkotaKode": "32.73",
      "kecamatanKode": null,
      "desaKode": null,
      "alamatLengkap": null,
      "caraBermain": "Berjalan dengan tongkat...",
      "nilaiMoral": "Melatih keseimbangan...",
      "targetUsia": "REMAJA",
      "peralatan": [...],
      "fotoKegiatan": [],
      "videoKegiatan": [],
      "created_at": "2024-02-06T11:00:00.000Z",
      "updated_at": "2024-02-06T11:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| data | PROT[] | Array of PROT objects |
| pagination | object | Pagination metadata |
| pagination.total | number | Total jumlah semua records (sesuai filter) |
| pagination.page | number | Halaman saat ini |
| pagination.limit | number | Jumlah items per halaman |
| pagination.totalPages | number | Total jumlah halaman |
| pagination.hasNext | boolean | Ada halaman selanjutnya atau tidak |
| pagination.hasPrev | boolean | Ada halaman sebelumnya atau tidak |

---

### 3. Get PROT by ID

Mengambil data PROT spesifik berdasarkan ID.

**Endpoint:** `GET /prot/:id`

**Authentication:** Public (tidak memerlukan token)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT yang ingin diambil |

**Request Example:**
```
GET /prot/550e8400-e29b-41d4-a716-446655440001
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing",
  "jenis": "PERMAINAN_RAKYAT",
  "statusAsalUsul": "Permainan tradisional yang sudah ada sejak zaman kerajaan di Indonesia",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "kecamatanKode": null,
  "desaKode": null,
  "alamatLengkap": null,
  "caraBermain": "Gasing diputar menggunakan tali yang dililitkan pada bagian badan gasing",
  "nilaiMoral": "Melatih kesabaran, ketelitian, dan motorik halus anak",
  "targetUsia": "ANAK",
  "peralatan": [
    {
      "nama": "Gasing",
      "deskripsi": "Gasing kayu dengan paku di bagian bawah",
      "kisaranHarga": "10.000 - 50.000",
      "fotoAlat": null
    }
  ],
  "fotoKegiatan": [
    "https://s3.amazonaws.com/bucket/prot/foto-kegiatan/uuid1.jpg",
    "https://s3.amazonaws.com/bucket/prot/foto-kegiatan/uuid2.jpg"
  ],
  "videoKegiatan": [
    "https://s3.amazonaws.com/bucket/prot/video-kegiatan/uuid3.mp4"
  ],
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T10:00:00.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "PROT with ID 550e8400-e29b-41d4-a716-446655440999 not found",
  "error": "Not Found"
}
```

---

### 4. Update PROT

Update data PROT (partial update).

**Endpoint:** `PATCH /prot/:id`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT yang ingin diupdate |

**Request Body:**
Same as CreatePROTDto but all fields are optional.

**Request Example:**
```json
PATCH /prot/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
Content-Type: application/json

{
  "nama": "Gasing Aceh",
  "statusAsalUsul": "Permainan tradisional khas Aceh"
}
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing Aceh",
  "jenis": "PERMAINAN_RAKYAT",
  "statusAsalUsul": "Permainan tradisional khas Aceh",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "kecamatanKode": null,
  "desaKode": null,
  "alamatLengkap": null,
  "caraBermain": "Gasing diputar...",
  "nilaiMoral": "Melatih kesabaran...",
  "targetUsia": "ANAK",
  "peralatan": [...],
  "fotoKegiatan": [],
  "videoKegiatan": [],
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T12:00:00.000Z"
}
```

**Note:** Ada juga endpoint `PUT /prot/:id` yang berfungsi sama dengan PATCH.

---

### 5. Delete PROT

Menghapus data PROT.

**Endpoint:** `DELETE /prot/:id`

**Authentication:** Required (Role: `admin_kpoti` only)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT yang ingin dihapus |

**Request Example:**
```
DELETE /prot/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**
```json
{
  "message": "PROT deleted successfully"
}
```

**Error Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions"
}
```

---

### 6. Upload Foto Kegiatan

Upload foto kegiatan untuk PROT tertentu.

**Endpoint:** `POST /prot/:id/foto-kegiatan`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT |

**Request Body:**
`multipart/form-data` dengan field name `files` (max 10 files)

**Allowed File Types:**
- image/jpeg
- image/jpg
- image/png
- image/webp

**Max File Size:** 100MB per file

**Request Example:**
```
POST /prot/550e8400-e29b-41d4-a716-446655440001/foto-kegiatan
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: [file1.jpg, file2.png, ...]
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/prot/550e8400-e29b-41d4-a716-446655440001/foto-kegiatan \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/photo1.jpg" \
  -F "files=@/path/to/photo2.jpg"
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing",
  "jenis": "PERMAINAN_RAKYAT",
  "statusAsalUsul": "Permainan tradisional...",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "kecamatanKode": null,
  "desaKode": null,
  "alamatLengkap": null,
  "caraBermain": "Gasing diputar...",
  "nilaiMoral": "Melatih kesabaran...",
  "targetUsia": "ANAK",
  "peralatan": [...],
  "fotoKegiatan": [
    "https://bucket.s3.region.amazonaws.com/prot/foto-kegiatan/uuid1.jpg",
    "https://bucket.s3.region.amazonaws.com/prot/foto-kegiatan/uuid2.jpg",
    "https://bucket.s3.region.amazonaws.com/prot/foto-kegiatan/uuid3.jpg"
  ],
  "videoKegiatan": [],
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T12:00:00.000Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "No files provided"
}
```

---

### 7. Upload Video Kegiatan

Upload video kegiatan untuk PROT tertentu.

**Endpoint:** `POST /prot/:id/video-kegiatan`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT |

**Request Body:**
`multipart/form-data` dengan field name `files` (max 10 files)

**Allowed File Types:**
- video/mp4
- video/quicktime (.mov)

**Max File Size:** 100MB per file

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/prot/550e8400-e29b-41d4-a716-446655440001/video-kegiatan \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/video1.mp4"
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing",
  "jenis": "PERMAINAN_RAKYAT",
  "statusAsalUsul": "Permainan tradisional...",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  "kecamatanKode": null,
  "desaKode": null,
  "alamatLengkap": null,
  "caraBermain": "Gasing diputar...",
  "nilaiMoral": "Melatih kesabaran...",
  "targetUsia": "ANAK",
  "peralatan": [...],
  "fotoKegiatan": [...],
  "videoKegiatan": [
    "https://bucket.s3.region.amazonaws.com/prot/video-kegiatan/uuid1.mp4"
  ],
  "created_at": "2024-02-06T10:00:00.000Z",
  "updated_at": "2024-02-06T12:00:00.000Z"
}
```

---

### 8. Delete Foto Kegiatan

Menghapus foto kegiatan berdasarkan index.

**Endpoint:** `DELETE /prot/:id/foto-kegiatan/:index`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT |
| index | number | Yes | Index foto dalam array (0-based) |

**Request Example:**
```
DELETE /prot/550e8400-e29b-41d4-a716-446655440001/foto-kegiatan/0
Authorization: Bearer <token>
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "fotoKegiatan": [
    "https://bucket.s3.region.amazonaws.com/prot/foto-kegiatan/uuid2.jpg",
    "https://bucket.s3.region.amazonaws.com/prot/foto-kegiatan/uuid3.jpg"
  ],
  ...
}
```

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Invalid index: 5"
}
```

---

### 9. Delete Video Kegiatan

Menghapus video kegiatan berdasarkan index.

**Endpoint:** `DELETE /prot/:id/video-kegiatan/:index`

**Authentication:** Required (Role: `kurator_daerah`, `admin_kpoti`)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID PROT |
| index | number | Yes | Index video dalam array (0-based) |

**Request Example:**
```
DELETE /prot/550e8400-e29b-41d4-a716-446655440001/video-kegiatan/0
Authorization: Bearer <token>
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "videoKegiatan": [],
  ...
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

**Error Examples:**
```json
// Missing parent
{
  "statusCode": 400,
  "message": "kabkotaKode is required when kecamatanKode is provided"
}

// Invalid daerah code
{
  "statusCode": 400,
  "message": "Invalid kabkotaKode: 99.99"
}
```

---

## Common Use Cases

### 1. Form Create/Edit PROT dengan Lokasi Bertingkat

**Step 1:** Load semua provinsi untuk dropdown pertama
```
GET /daerah/provinces?page=1&limit=50
```

**Step 2:** Saat user memilih provinsi, load kabupaten/kota
```
GET /daerah/{provinsi_id}/children?page=1&limit=50
```

**Step 3:** Saat user memilih kabupaten/kota, load kecamatan (opsional)
```
GET /daerah/{kabkota_id}/children?page=1&limit=50
```

**Step 4:** Saat user memilih kecamatan, load desa (opsional)
```
GET /daerah/{kecamatan_id}/children?page=1&limit=50
```

**Step 5:** Submit dengan `kode` daerah yang dipilih
```
POST /prot
{
  "nama": "Gasing",
  "provinsiKode": "11",
  "kabkotaKode": "11.01",
  ...
}
```

### 2. Gallery Grid dengan Filter

**Frontend Implementation:**
```typescript
// Fetch with filters
const fetchPROT = async (filters: {
  jenis?: 'PERMAINAN_RAKYAT' | 'OLAHRAGA_TRADISIONAL';
  provinsi?: string;
  targetUsia?: 'ANAK' | 'REMAJA' | 'DEWASA' | 'SEMUA_USIA';
  page: number;
}) => {
  const params = new URLSearchParams();
  if (filters.jenis) params.set('jenis', filters.jenis);
  if (filters.provinsi) params.set('provinsi', filters.provinsi);
  if (filters.targetUsia) params.set('targetUsia', filters.targetUsia);
  params.set('page', filters.page.toString());
  params.set('limit', '12');

  const response = await fetch(`/api/prot?${params}`);
  return response.json();
};
```

### 3. Upload Progress Indicator

```typescript
const uploadFotoKegiatan = async (
  protId: string,
  files: File[]
): Promise<void> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch(`/api/prot/${protId}/foto-kegiatan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }
};
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error, no files, invalid index) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (PROT not found) |
| 413 | Payload Too Large (file > 100MB) |
| 415 | Unsupported Media Type (invalid file type) |
| 500 | Internal Server Error |

---

## Rate Limiting

All endpoints are subject to rate limiting:
- **Default:** 100 requests per minute per IP
- **Burst:** Up to 100 requests in 60 seconds

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1645123456
```

---

## Notes

- **Public endpoints:** GET list and GET detail tidak memerlukan authentication
- **File upload:** Max 10 files per request, 100MB per file
- **Foto/Video URLs:** URLs langsung ke S3, bisa digunakan di frontend
- **Pagination:** Gunakan `page` dan `limit` untuk pagination
- **Search:** Gunakan parameter `search` untuk pencarian by nama (case-insensitive, partial match)
- **Location filter:** Bisa filter sampai level desa untuk konten yang spesifik
- **Daerah validation:** Selalu gunakan cascade yang benar (provinsi -> kabkota -> kecamatan -> desa)
