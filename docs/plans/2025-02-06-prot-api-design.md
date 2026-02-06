# PROT API Design

**Date:** 2025-02-06
**Module:** PROT (Permainan Rakyat dan Olahraga Tradisional)

## Overview

API untuk mengelola data Permainan Rakyat dan Olahraga Tradisional (PROT) dengan dukungan file upload dan URL hybrid.

## Entity Structure

### PROT Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `nama` | string | Nama permainan/olahraga |
| `jenis` | enum | PROT_JENIS.PERMAINAN_RAKYAT atau OLAHRAGA_TRADISIONAL |
| `statusAsalUsul` | text | Deskripsi asal usul |
| `provinsiKode` | string | Kode daerah provinsi |
| `kabkotaKode` | string | Kode daerah kabupaten/kota |
| `kecamatanKode` | string | Kode daerah kecamatan |
| `desaKode` | string | Kode daerah desa |
| `alamatLengkap` | string | Alamat lengkap (embedded) |
| `caraBermain` | text | Cara bermain |
| `nilaiMoral` | text | Nilai moral |
| `targetUsia` | enum | TARGET_USIA.ANAK, REMAJA, DEWASA, SEMUA_USIA |
| `peralatan` | jsonb | Array of Peralatan |
| `fotoKegiatan` | jsonb | Array of URL strings |
| `videoKegiatan` | jsonb | Array of URL strings |
| `created_at` | timestamp | Auto-generated |
| `updated_at` | timestamp | Auto-generated |

### Enums

```typescript
enum PROT_JENIS {
  PERMAINAN_RAKYAT = 'PERMAINAN_RAKYAT',
  OLAHRAGA_TRADISIONAL = 'OLAHRAGA_TRADISIONAL'
}

enum TARGET_USIA {
  ANAK = 'ANAK',          // 6-12 tahun
  REMAJA = 'REMAJA',      // 13-17 tahun
  DEWASA = 'DEWASA',      // 18+ tahun
  SEMUA_USIA = 'SEMUA_USIA'
}
```

### Peralatan JSON Structure

```json
[
  {
    "nama": "Gasing",
    "deskripsi": "Gasing kayu",
    "kisaranHarga": "10000-50000",
    "fotoAlat": ["url1", "url2"]
  }
]
```

## API Endpoints

**Base Path:** `/api/prot`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create PROT baru |
| `GET` | `/` | List semua PROT |
| `GET` | `/:id` | Detail PROT by ID |
| `PATCH` | `/:id` | Update PROT sebagian |
| `PUT` | `/:id` | Update PROT keseluruhan |
| `DELETE` | `/:id` | Delete PROT |
| `POST` | `/:id/foto-kegiatan` | Upload foto kegiatan |
| `POST` | `/:id/video-kegiatan` | Upload video kegiatan |
| `DELETE` | `/:id/foto-kegiatan/:index` | Hapus foto by index |
| `DELETE` | `/:id/video-kegiatan/:index` | Hapus video by index |

### Query Params (List)

- `page`: number (default 1)
- `limit`: number (default 10)
- `jenis`: PERMAINAN_RAKYAT | OLAHRAGA_TRADISIONAL
- `provinsi`: string (kode provinsi)
- `kabkota`: string (kode kabkota)
- `kecamatan`: string (kode kecamatan)
- `desa`: string (kode desa)
- `targetUsia`: ANAK | REMAJA | DEWASA | SEMUA_USIA
- `search`: string (search by nama)

## DTOs

### CreatePROTDto

```typescript
nama: string (required, min 3)
jenis: PROT_JENIS (required)
statusAsalUsul: string (optional)
provinsiKode: string (optional)
kabkotaKode: string (optional)
kecamatanKode: string (optional)
desaKode: string (optional)
alamatLengkap: string (optional)
caraBermain: string (optional)
nilaiMoral: string (optional)
targetUsia: TARGET_USIA (required)
peralatan: PeralatanDto[] (optional)
fotoKegiatan: string[] (optional)
videoKegiatan: string[] (optional)
```

### PeralatanDto

```typescript
nama: string (required)
deskripsi: string (optional)
kisaranHarga: string (optional)
fotoAlat: string[] (optional)
```

### UpdatePROTDto

All fields optional (partial update).

### QueryPROTDto

```typescript
page?: number
limit?: number
jenis?: PROT_JENIS
provinsi?: string
kabkota?: string
kecamatan?: string
desa?: string
targetUsia?: TARGET_USIA
search?: string
```

## Service Layer

**PROTService Methods:**

| Method | Description |
|--------|-------------|
| `create(createDto, user?)` | Create PROT baru |
| `findAll(query)` | List dengan pagination & filter |
| `findOne(id)` | Get detail by ID |
| `update(id, updateDto)` | Update PROT |
| `remove(id)` | Delete PROT |
| `addFotoKegiatan(id, files[])` | Upload & tambah foto kegiatan |
| `addVideoKegiatan(id, files[])` | Upload & tambah video kegiatan |
| `removeFotoKegiatan(id, index)` | Hapus foto by index |
| `removeVideoKegiatan(id, index)` | Hapus video by index |

## File Handling

1. **Hybrid URL handling:**
   - String starting with `http://` or `https://` → use as URL
   - File upload → upload to StorageService

2. **File type validation:**
   - Images: jpg, png, webp
   - Videos: mp4, mov

3. **File size limit:** 100MB per file

## Error Handling

| Error Case | HTTP Status |
|-----------|-------------|
| PROT tidak ditemukan | 404 |
| Validasi gagal | 400 |
| Kode daerah tidak valid | 400 |
| File upload gagal | 400 |
| Unauthorized | 401 |

## Validasi

- Cascade daerah: jika `kabkotaKode` diisi, `provinsiKode` harus diisi, dst.
- Validasi kode daerah dari entity Daerah

## Module Dependencies

- `TypeOrmModule.forFeature([PROT])`
- `StorageModule` - untuk upload
- `DaerahModule` - untuk validasi kode daerah

## File Structure

```
src/modules/prot/
├── entities/
│   └── prot.entity.ts
├── dto/
│   ├── create-prot.dto.ts
│   ├── update-prot.dto.ts
│   ├── query-prot.dto.ts
│   └── peralatan.dto.ts
├── prot.controller.ts
├── prot.service.ts
└── prot.module.ts
```
