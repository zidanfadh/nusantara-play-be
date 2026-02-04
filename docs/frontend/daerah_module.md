# Daerah Module Documentation

## Overview
Daerah module menangani data wilayah/geografis di Indonesia (provinsi, kabupaten, kota). Module ini menyediakan endpoint untuk mengambil data daerah yang digunakan untuk lokasi user, konten, dll.

## Base URL
```
/daerah
```

---

## Data Model

### Daerah Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| nama | string | Yes | Nama daerah |
| kode | string | Yes | Kode daerah (unique) |
| provinsi | string | Yes | Nama provinsi |
| level | enum | Yes | `provinsi`, `kabupaten`, `kota` |
| parent_id | UUID | No | ID daerah induk (untuk kabupaten/kota) |
| latitude | decimal | No | Koordinat latitude |
| longitude | decimal | No | Koordinat longitude |
| metadata | jsonb | No | Data tambahan (flexible) |
| created_at | timestamp | Auto | Tanggal dibuat |
| updated_at | timestamp | Auto | Tanggal diupdate |

### DaerahLevel Enum

| Value | Description |
|-------|-------------|
| `provinsi` | Level provinsi |
| `kabupaten` | Level kabupaten |
| `kota` | Level kota |

---

## Endpoints

### 1. Get All Daerah

Mengambil semua data daerah dengan pagination. Bisa difilter oleh level atau provinsi.

**Endpoint:** `GET /daerah`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| level | string | No | - | Filter by level: `provinsi`, `kabupaten`, `kota` |
| provinsi | string | No | - | Filter by nama provinsi |
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Note:** Jika `level` atau `provinsi` diberikan, hasil akan difilter accordingly.

**Request Examples:**
```
GET /daerah?page=1&limit=20
GET /daerah?level=provinsi
GET /daerah?level=kabupaten&page=1&limit=50
GET /daerah?provinsi=Jawa Barat
GET /daerah?level=kota&provinsi=Jawa Tengah&page=1&limit=10
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nama": "Jawa Barat",
      "kode": "32",
      "provinsi": "Jawa Barat",
      "level": "provinsi",
      "parent_id": null,
      "latitude": -6.93200000,
      "longitude": 107.62300000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "nama": "Kabupaten Bandung",
      "kode": "32.01",
      "provinsi": "Jawa Barat",
      "level": "kabupaten",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "latitude": -7.05200000,
      "longitude": 107.54300000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "nama": "Kota Bandung",
      "kode": "32.73",
      "provinsi": "Jawa Barat",
      "level": "kota",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "latitude": -6.91750000,
      "longitude": 107.61910000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 514,
    "page": 1,
    "limit": 20,
    "totalPages": 26,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| data | Daerah[] | Array of daerah objects |
| pagination | object | Pagination metadata |
| pagination.total | number | Total jumlah semua records (sesuai filter) |
| pagination.page | number | Halaman saat ini |
| pagination.limit | number | Jumlah items per halaman |
| pagination.totalPages | number | Total jumlah halaman |
| pagination.hasNext | boolean | Ada halaman selanjutnya atau tidak |
| pagination.hasPrev | boolean | Ada halaman sebelumnya atau tidak |

**Note:** Results diurutkan oleh `provinsi` ASC, `nama` ASC.

**Use Case:** Dropdown daerah di form, filter konten berdasarkan lokasi.

---

### 2. Get All Provinces

Mengambil semua data provinsi dengan pagination.

**Endpoint:** `GET /daerah/provinces`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Body:** None

**Request Examples:**
```
GET /daerah/provinces
GET /daerah/provinces?page=1&limit=50
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nama": "Jawa Barat",
      "kode": "32",
      "provinsi": "Jawa Barat",
      "level": "provinsi",
      "parent_id": null,
      "latitude": -6.93200000,
      "longitude": 107.62300000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "nama": "Jawa Tengah",
      "kode": "33",
      "provinsi": "Jawa Tengah",
      "level": "provinsi",
      "parent_id": null,
      "latitude": -7.15000000,
      "longitude": 110.25000000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "nama": "DI Yogyakarta",
      "kode": "34",
      "provinsi": "DI Yogyakarta",
      "level": "provinsi",
      "parent_id": null,
      "latitude": -7.97970000,
      "longitude": 110.36950000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 34,
    "page": 1,
    "limit": 10,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Note:** Results diurutkan oleh `nama` ASC.

**Use Case:** Dropdown provinsi di form register/edit profile.

---

### 3. Get Daerah Statistics

Mengambil statistik data daerah.

**Endpoint:** `GET /daerah/stats`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:** None

**Request Body:** None

**Success Response (200 OK):**
```json
{
  "total": 514,
  "provinces": 34,
  "kabupaten": 415,
  "kota": 65
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| total | number | Total jumlah semua daerah |
| provinces | number | Jumlah provinsi |
| kabupaten | number | Jumlah kabupaten |
| kota | number | Jumlah kota |

**Use Case:** Dashboard admin untuk melihat statistik daerah.

---

### 4. Get Daerah by ID

Mengambil data daerah spesifik berdasarkan ID.

**Endpoint:** `GET /daerah/:id`

**Authentication:** Public (tidak memerlukan token)

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID daerah yang ingin diambil |

**Request Examples:**
```
GET /daerah/550e8400-e29b-41d4-a716-446655440002
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "nama": "Kabupaten Bandung",
  "kode": "32.01",
  "provinsi": "Jawa Barat",
  "level": "kabupaten",
  "parent_id": "550e8400-e29b-41d4-a716-446655440001",
  "latitude": -7.05200000,
  "longitude": 107.54300000,
  "metadata": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Daerah with ID 550e8400-e29b-41d4-a716-446655440999 not found",
  "error": "Not Found"
}
```

**Use Case:** Mendapatkan detail daerah untuk ditampilkan di halaman detail.

---

### 5. Get Children Daerah

Mengambil daerah anak (children) dari sebuah daerah dengan pagination. Biasanya untuk mendapatkan semua kabupaten/kota dalam sebuah provinsi.

**Endpoint:** `GET /daerah/:id/children`

**Authentication:** Public (tidak memerlukan token)

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID daerah parent (biasanya provinsi) |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Examples:**
```
GET /daerah/550e8400-e29b-41d4-a716-446655440001/children
GET /daerah/550e8400-e29b-41d4-a716-446655440001/children?page=1&limit=50
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "nama": "Kabupaten Bandung",
      "kode": "32.01",
      "provinsi": "Jawa Barat",
      "level": "kabupaten",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "latitude": -7.05200000,
      "longitude": 107.54300000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "nama": "Kota Bandung",
      "kode": "32.73",
      "provinsi": "Jawa Barat",
      "level": "kota",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "latitude": -6.91750000,
      "longitude": 107.61910000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440006",
      "nama": "Kabupaten Bogor",
      "kode": "32.02",
      "provinsi": "Jawa Barat",
      "level": "kabupaten",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "latitude": -6.59500000,
      "longitude": 106.78800000,
      "metadata": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 29,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Note:** Results diurutkan oleh `nama` ASC.

**Use Case:** Setelah user memilih provinsi, load semua kabupaten/kota dalam provinsi tersebut untuk dropdown kedua.

---

## Hierarchical Structure

Data daerah memiliki struktur hierarkis:

```
Provinsi (parent_id = null)
  ├── Kabupaten (parent_id = provinsi.id)
  └── Kota (parent_id = provinsi.id)
```

**Contoh:**
- Jawa Barat (provinsi)
  - Kabupaten Bandung (kabupaten, parent_id = Jawa Barat.id)
  - Kota Bandung (kota, parent_id = Jawa Barat.id)
  - Kabupaten Bogor (kabupaten, parent_id = Jawa Barat.id)

---

## Common Use Cases

### 1. Form Register/Edit User dengan Daerah

**Step 1:** Load semua provinsi untuk dropdown pertama
```
GET /daerah/provinces?page=1&limit=50
```

**Step 2:** Saat user memilih provinsi, load kabupaten/kota
```
GET /daerah/{provinsi_id}/children?page=1&limit=50
```

**Step 3:** Simpan `daerah_id` ke user profile

### 2. Filter Konten berdasarkan Lokasi

**Filter berdasarkan provinsi:**
```
GET /daerah?provinsi=Jawa Barat
```

**Filter berdasarkan level:**
```
GET /daerah?level=kabupaten
```

### 3. Display Lokasi dengan Koordinat

Gunakan `latitude` dan `longitude` untuk menampilkan lokasi di map.

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 404 | Not Found (daerah tidak ditemukan) |
| 500 | Internal Server Error |

---

## Notes

- Semua endpoint daerah adalah public (tidak memerlukan authentication)
- Data daerah bersifat read-only dari API (tidak ada endpoint create/update/delete)
- `kode` mengikuti format kode wilayah Indonesia (misal: "32" untuk Jawa Barat, "32.01" untuk Kab. Bandung)
- `metadata` bisa digunakan untuk menyimpan data tambahan yang fleksibel
- Semua endpoint list menggunakan pagination untuk performance
- Gunakan `limit` yang lebih besar (misal 50-100) untuk dropdown agar tidak perlu banyak pagination
