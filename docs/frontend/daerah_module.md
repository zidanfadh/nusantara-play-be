# Daerah Module Documentation

## Overview

Daerah module menangani data wilayah/geografis Indonesia secara hierarkis, mulai dari **provinsi** hingga **kelurahan/desa**. Module ini menyediakan endpoint publik untuk navigasi data wilayah, cascading dropdown, pencarian, dan breadcrumb.

## Base URL

```
/daerah
```

---

## Data Model

### Daerah Entity

| Field      | Type       | Required | Description                                                             |
| ---------- | ---------- | -------- | ----------------------------------------------------------------------- |
| id         | UUID       | Auto     | Primary key                                                             |
| nama       | string     | Yes      | Nama daerah (tanpa prefix)                                              |
| kode       | string(15) | Yes      | Kode BPS daerah (unique)                                                |
| provinsi   | string     | Yes      | Nama provinsi induk                                                     |
| level      | enum       | Yes      | `provinsi`, `kabupaten`, `kota`, `kecamatan`, `kelurahan`, `desa`       |
| parent_id  | UUID       | No       | ID daerah induk                                                         |
| prefix     | string(50) | No       | Nama jabatan administratif (misal: "Kabupaten", "Kecamatan", "Gampong") |
| latitude   | decimal    | No       | Koordinat latitude                                                      |
| longitude  | decimal    | No       | Koordinat longitude                                                     |
| metadata   | jsonb      | No       | Data tambahan (flexible)                                                |
| created_at | timestamp  | Auto     | Tanggal dibuat                                                          |
| updated_at | timestamp  | Auto     | Tanggal diupdate                                                        |

### DaerahLevel Enum

| Value       | Description                                           |
| ----------- | ----------------------------------------------------- |
| `provinsi`  | Level 1 — Provinsi                                    |
| `kabupaten` | Level 2 — Kabupaten                                   |
| `kota`      | Level 2 — Kota                                        |
| `kecamatan` | Level 3 — Kecamatan / Distrik / Kapanewon / Kemantren |
| `kelurahan` | Level 4 — Kelurahan                                   |
| `desa`      | Level 4 — Desa / Gampong / Nagari / Kampung / dll     |

### Kode BPS Format

| Level          | Format          | Contoh                          | Panjang |
| -------------- | --------------- | ------------------------------- | ------- |
| Provinsi       | `XX`            | `32` (Jawa Barat)               | 2       |
| Kabupaten/Kota | `XX.XX`         | `32.01` (Kab. Bandung)          | 5       |
| Kecamatan      | `XX.XX.XX`      | `32.01.01` (Kec. Cimenyan)      | 8       |
| Kelurahan/Desa | `XX.XX.XX.XXXX` | `32.01.01.2001` (Desa Cimenyan) | 13      |

### Prefix (Nama Administratif Lokal)

Field `prefix` menyimpan nama jabatan administratif yang bervariasi antar daerah:

| Level     | Prefix Umum | Variasi Lokal                                                                           |
| --------- | ----------- | --------------------------------------------------------------------------------------- |
| Provinsi  | Provinsi    | —                                                                                       |
| Kabupaten | Kabupaten   | Kabupaten Administrasi (DKI Jakarta)                                                    |
| Kota      | Kota        | Kota Administrasi (DKI Jakarta)                                                         |
| Kecamatan | Kecamatan   | Distrik (Papua), Kapanewon/Kemantren (DIY)                                              |
| Kelurahan | Kelurahan   | —                                                                                       |
| Desa      | Desa        | Gampong (Aceh), Nagari (Sumbar), Kalurahan (DIY), Kampung (Papua), Pekon (Lampung), dll |

Gunakan `prefix` + `nama` untuk menampilkan nama lengkap: misal `"Kecamatan"` + `"Cimenyan"` = `"Kecamatan Cimenyan"`.

---

## Hierarchical Structure

Data daerah memiliki struktur hierarkis 4 level:

```
Provinsi (parent_id = null)
  ├── Kabupaten (parent_id = provinsi.id)
  │     └── Kecamatan (parent_id = kabupaten.id)
  │           ├── Kelurahan (parent_id = kecamatan.id)
  │           └── Desa (parent_id = kecamatan.id)
  └── Kota (parent_id = provinsi.id)
        └── Kecamatan (parent_id = kota.id)
              ├── Kelurahan (parent_id = kecamatan.id)
              └── Desa (parent_id = kecamatan.id)
```

**Contoh:**

- Jawa Barat (provinsi, kode: `32`)
  - Kabupaten Bandung (kabupaten, kode: `32.01`)
    - Kecamatan Cimenyan (kecamatan, kode: `32.01.01`)
      - Desa Cimenyan (desa, kode: `32.01.01.2001`)
      - Kelurahan Mekarsaluyu (kelurahan, kode: `32.01.01.1001`)
  - Kota Bandung (kota, kode: `32.73`)
    - Kecamatan Bandung Wetan (kecamatan, kode: `32.73.01`)

---

## Endpoints

### 1. Get All Daerah

Mengambil data daerah dengan pagination dan filter.

**Endpoint:** `GET /daerah`

**Authentication:** Public

**Query Parameters:**

| Parameter | Type          | Required | Default | Description                                                                        |
| --------- | ------------- | -------- | ------- | ---------------------------------------------------------------------------------- |
| level     | string        | No       | -       | Filter by level: `provinsi`, `kabupaten`, `kota`, `kecamatan`, `kelurahan`, `desa` |
| provinsi  | string        | No       | -       | Filter by nama provinsi                                                            |
| parent_id | string (UUID) | No       | -       | Filter by parent daerah ID                                                         |
| page      | number        | No       | 1       | Halaman yang ingin diambil                                                         |
| limit     | number        | No       | 10      | Jumlah items per halaman                                                           |

**Request Examples:**

```
GET /daerah?page=1&limit=20
GET /daerah?level=provinsi
GET /daerah?level=kecamatan&provinsi=Jawa Barat&page=1&limit=50
GET /daerah?parent_id=550e8400-e29b-41d4-a716-446655440001
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
      "prefix": "Provinsi",
      "latitude": null,
      "longitude": null,
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

**Pagination Schema (berlaku untuk semua endpoint list):**

| Field      | Type    | Description                                |
| ---------- | ------- | ------------------------------------------ |
| total      | number  | Total jumlah semua records (sesuai filter) |
| page       | number  | Halaman saat ini                           |
| limit      | number  | Jumlah items per halaman                   |
| totalPages | number  | Total jumlah halaman                       |
| hasNext    | boolean | Ada halaman selanjutnya                    |
| hasPrev    | boolean | Ada halaman sebelumnya                     |

**Note:** Results diurutkan `provinsi` ASC, `nama` ASC.

---

### 2. Get All Provinces

Mengambil semua data provinsi.

**Endpoint:** `GET /daerah/provinces`

**Authentication:** Public

**Query Parameters:**

| Parameter | Type   | Required | Default | Description       |
| --------- | ------ | -------- | ------- | ----------------- |
| page      | number | No       | 1       | Halaman           |
| limit     | number | No       | 10      | Items per halaman |

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
      "id": "...",
      "nama": "Aceh",
      "kode": "11",
      "provinsi": "Aceh",
      "level": "provinsi",
      "parent_id": null,
      "prefix": "Provinsi",
      "latitude": null,
      "longitude": null,
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

**Use Case:** Dropdown provinsi di form register/edit profile.

---

### 3. Search Daerah

Mencari daerah berdasarkan nama (case-insensitive). Opsional filter by level.

**Endpoint:** `GET /daerah/search`

**Authentication:** Public

**Query Parameters:**

| Parameter | Type   | Required | Default | Description                        |
| --------- | ------ | -------- | ------- | ---------------------------------- |
| q         | string | Yes      | -       | Kata kunci pencarian (nama daerah) |
| level     | string | No       | -       | Filter by level                    |
| page      | number | No       | 1       | Halaman                            |
| limit     | number | No       | 20      | Items per halaman                  |

**Request Examples:**

```
GET /daerah/search?q=bandung
GET /daerah/search?q=bandung&level=kecamatan
GET /daerah/search?q=cimen&level=desa&page=1&limit=10
```

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "...",
      "nama": "Bandung",
      "kode": "32.73",
      "provinsi": "Jawa Barat",
      "level": "kota",
      "parent_id": "...",
      "prefix": "Kota",
      "latitude": null,
      "longitude": null,
      "metadata": null,
      "created_at": "...",
      "updated_at": "..."
    },
    {
      "id": "...",
      "nama": "Bandung",
      "kode": "32.01",
      "provinsi": "Jawa Barat",
      "level": "kabupaten",
      "parent_id": "...",
      "prefix": "Kabupaten",
      "latitude": null,
      "longitude": null,
      "metadata": null,
      "created_at": "...",
      "updated_at": "..."
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

**Note:** Results diurutkan `level` ASC (provinsi dulu), `nama` ASC.

**Use Case:** Searchable dropdown / autocomplete input untuk memilih daerah.

---

### 4. Get Daerah Statistics

Mengambil statistik jumlah daerah per level.

**Endpoint:** `GET /daerah/stats`

**Authentication:** Public

**Success Response (200 OK):**

```json
{
  "total": 91183,
  "provinces": 34,
  "kabupaten": 415,
  "kota": 65,
  "kecamatan": 7230,
  "kelurahan": 8506,
  "desa": 74933
}
```

**Response Schema:**

| Field     | Type   | Description        |
| --------- | ------ | ------------------ |
| total     | number | Total semua daerah |
| provinces | number | Jumlah provinsi    |
| kabupaten | number | Jumlah kabupaten   |
| kota      | number | Jumlah kota        |
| kecamatan | number | Jumlah kecamatan   |
| kelurahan | number | Jumlah kelurahan   |
| desa      | number | Jumlah desa        |

**Use Case:** Dashboard transparansi & statistik.

---

### 5. Get Daerah by Kode

Mengambil data daerah berdasarkan kode BPS.

**Endpoint:** `GET /daerah/by-kode/:kode`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| kode | string | Yes | Kode BPS daerah (misal `32`, `32.01`, `32.01.01`) |

**Request Examples:**

```
GET /daerah/by-kode/32
GET /daerah/by-kode/32.01
GET /daerah/by-kode/32.01.01
GET /daerah/by-kode/32.01.01.2001
```

**Success Response (200 OK):**

```json
{
  "id": "...",
  "nama": "Bandung",
  "kode": "32.01",
  "provinsi": "Jawa Barat",
  "level": "kabupaten",
  "parent_id": "...",
  "prefix": "Kabupaten",
  "latitude": null,
  "longitude": null,
  "metadata": null,
  "created_at": "...",
  "updated_at": "..."
}
```

**Error Response (404 Not Found):**

```json
{
  "statusCode": 404,
  "message": "Daerah with code 99.99 not found",
  "error": "Not Found"
}
```

**Use Case:** Lookup daerah ketika hanya punya kode BPS (integrasi data, deep link).

---

### 6. Get Children by Kode

Mengambil semua anak daerah berdasarkan kode BPS parent.

**Endpoint:** `GET /daerah/by-kode/:kode/children`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| kode | string | Yes | Kode BPS daerah parent |

**Query Parameters:**

| Parameter | Type   | Required | Default | Description       |
| --------- | ------ | -------- | ------- | ----------------- |
| page      | number | No       | 1       | Halaman           |
| limit     | number | No       | 50      | Items per halaman |

**Request Examples:**

```
GET /daerah/by-kode/32/children              # kab/kota di Jawa Barat
GET /daerah/by-kode/32.01/children           # kecamatan di Kab. Bandung
GET /daerah/by-kode/32.01.01/children        # kelurahan/desa di Kec. Cimenyan
```

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "...",
      "nama": "Cimenyan",
      "kode": "32.01.01",
      "provinsi": "Jawa Barat",
      "level": "kecamatan",
      "parent_id": "...",
      "prefix": "Kecamatan",
      "latitude": null,
      "longitude": null,
      "metadata": null,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": {
    "total": 31,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Note:** Results diurutkan `kode` ASC, `nama` ASC.

**Use Case:** Cascading dropdown menggunakan kode BPS.

---

### 7. Get Ancestors by Kode (Breadcrumb)

Mengambil rantai hierarki dari root (provinsi) sampai daerah yang diminta.

**Endpoint:** `GET /daerah/by-kode/:kode/ancestors`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| kode | string | Yes | Kode BPS daerah |

**Request Examples:**

```
GET /daerah/by-kode/32.01.01.2001/ancestors
```

**Success Response (200 OK):**

```json
[
  {
    "id": "...",
    "nama": "Jawa Barat",
    "kode": "32",
    "level": "provinsi",
    "prefix": "Provinsi",
    "parent_id": null,
    "provinsi": "Jawa Barat"
  },
  {
    "id": "...",
    "nama": "Bandung",
    "kode": "32.01",
    "level": "kabupaten",
    "prefix": "Kabupaten",
    "parent_id": "...",
    "provinsi": "Jawa Barat"
  },
  {
    "id": "...",
    "nama": "Cimenyan",
    "kode": "32.01.01",
    "level": "kecamatan",
    "prefix": "Kecamatan",
    "parent_id": "...",
    "provinsi": "Jawa Barat"
  },
  {
    "id": "...",
    "nama": "Cimenyan",
    "kode": "32.01.01.2001",
    "level": "desa",
    "prefix": "Desa",
    "parent_id": "...",
    "provinsi": "Jawa Barat"
  }
]
```

**Note:** Array berurutan dari level paling tinggi (provinsi) ke paling rendah (daerah itu sendiri).

**Use Case:** Breadcrumb navigasi, menampilkan path lengkap dari daerah terpilih.

---

### 8. Get Daerah by ID

Mengambil data daerah berdasarkan UUID.

**Endpoint:** `GET /daerah/:id`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID daerah |

**Request Examples:**

```
GET /daerah/550e8400-e29b-41d4-a716-446655440002
```

**Success Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "nama": "Bandung",
  "kode": "32.01",
  "provinsi": "Jawa Barat",
  "level": "kabupaten",
  "parent_id": "550e8400-e29b-41d4-a716-446655440001",
  "prefix": "Kabupaten",
  "latitude": null,
  "longitude": null,
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

---

### 9. Get Children by ID

Mengambil daerah anak (children) dari sebuah daerah berdasarkan UUID.

**Endpoint:** `GET /daerah/:id/children`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID daerah parent |

**Query Parameters:**

| Parameter | Type   | Required | Default | Description       |
| --------- | ------ | -------- | ------- | ----------------- |
| page      | number | No       | 1       | Halaman           |
| limit     | number | No       | 50      | Items per halaman |

**Request Examples:**

```
GET /daerah/550e8400-e29b-41d4-a716-446655440001/children
GET /daerah/550e8400-e29b-41d4-a716-446655440001/children?page=1&limit=100
```

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "...",
      "nama": "Bandung",
      "kode": "32.01",
      "provinsi": "Jawa Barat",
      "level": "kabupaten",
      "parent_id": "550e8400-e29b-41d4-a716-446655440001",
      "prefix": "Kabupaten"
    }
  ],
  "pagination": {
    "total": 29,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Note:** Results diurutkan `kode` ASC, `nama` ASC.

**Use Case:** Cascading dropdown menggunakan UUID parent.

---

### 10. Get Ancestors by ID (Breadcrumb)

Mengambil rantai hierarki lengkap berdasarkan UUID.

**Endpoint:** `GET /daerah/:id/ancestors`

**Authentication:** Public

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID daerah |

**Request Examples:**

```
GET /daerah/550e8400-e29b-41d4-a716-446655440099/ancestors
```

**Success Response (200 OK):** Sama seperti `GET /daerah/by-kode/:kode/ancestors` — array berurutan dari provinsi sampai daerah itu sendiri.

---

## Common Use Cases

### 1. Cascading Dropdown (Provinsi → Kab/Kota → Kecamatan → Kelurahan/Desa)

**Step 1:** Load semua provinsi

```
GET /daerah/provinces?limit=50
```

**Step 2:** Saat user memilih provinsi, load kabupaten/kota

```
GET /daerah/{provinsi_id}/children?limit=100
# atau menggunakan kode:
GET /daerah/by-kode/32/children?limit=100
```

**Step 3:** Saat user memilih kabupaten/kota, load kecamatan

```
GET /daerah/{kabupaten_id}/children?limit=100
# atau:
GET /daerah/by-kode/32.01/children?limit=100
```

**Step 4:** Saat user memilih kecamatan, load kelurahan/desa

```
GET /daerah/{kecamatan_id}/children?limit=100
# atau:
GET /daerah/by-kode/32.01.01/children?limit=100
```

### 2. Searchable Daerah Picker

```
GET /daerah/search?q=bandung&limit=10
GET /daerah/search?q=cimenyan&level=kecamatan
```

### 3. Breadcrumb / Display Path

Tampilkan path lengkap daerah terpilih:

```
GET /daerah/by-kode/32.01.01.2001/ancestors
```

Hasil: `Provinsi Jawa Barat > Kabupaten Bandung > Kecamatan Cimenyan > Desa Cimenyan`

Format display: `{prefix} {nama}` untuk tiap item di array.

### 4. Display Nama Lengkap Daerah

Gunakan `prefix` + `nama`:

```
prefix: "Kecamatan", nama: "Cimenyan" → "Kecamatan Cimenyan"
prefix: "Gampong", nama: "Lam Asan" → "Gampong Lam Asan"
prefix: "Distrik", nama: "Jayapura Utara" → "Distrik Jayapura Utara"
```

### 5. Filter Konten berdasarkan Lokasi

```
GET /daerah?level=kabupaten&provinsi=Jawa Barat
GET /daerah?parent_id={kabupaten_id}
```

---

## Error Codes

| Status Code | Description                        |
| ----------- | ---------------------------------- |
| 200         | Success                            |
| 404         | Not Found — daerah tidak ditemukan |
| 500         | Internal Server Error              |

---

## Notes

- Semua endpoint daerah adalah **public** (tidak memerlukan authentication)
- Data daerah bersifat **read-only** dari API (tidak ada endpoint create/update/delete)
- Kode mengikuti format **BPS** (Badan Pusat Statistik) Indonesia
- Field `prefix` memuat nama jabatan administratif lokal — gunakan bersama `nama` untuk display lengkap
- Data saat ini mencakup ~91.000 record: 34 provinsi, 480 kab/kota, 7.230 kecamatan, ~83.000 kelurahan/desa
- Default limit untuk children adalah **50** (bukan 10) karena satu parent bisa punya banyak anak
- Gunakan endpoint `by-kode` untuk integrasi yang berbasis kode BPS tanpa perlu lookup UUID terlebih dulu
- Gunakan `search` endpoint untuk autocomplete/searchable input
- Gunakan `ancestors` endpoint untuk breadcrumb navigasi
