# NFT Catalog Module Documentation

## Overview

NFT Catalog module menangani katalog NFT informasional di Nusantara Play. Module ini **bukan marketplace transaksi NFT** dan tidak melakukan wallet connect, minting, transfer token, checkout, atau pembelian on-chain. Backend hanya menyimpan data profil NFT, penjelasan, About, detail blockchain, gambar, galeri, relasi opsional ke PROT, dan link eksternal ke platform pembelian seperti OpenSea.

Frontend menggunakan module ini untuk:

- Menampilkan daftar NFT yang sudah dipublish ke publik.
- Menampilkan halaman detail NFT dengan gambar, galeri, About, blockchain detail, dan tombol menuju marketplace eksternal.
- Menyediakan dashboard admin untuk upload gambar, create/edit NFT, publish/unpublish, dan soft delete.

## Base URL

```text
/api/nfts
```

---

## High-Level User Flow

### Public Visitor Flow

```text
User buka halaman NFT
  -> Frontend call GET /api/nfts
  -> Tampilkan NFT PUBLISHED + active
  -> User pilih NFT
  -> Frontend call GET /api/nfts/:id atau /api/nfts/slug/:slug
  -> Tampilkan detail NFT
  -> User klik "View on OpenSea" / marketplace link
  -> Browser membuka marketplace_url di tab baru
```

### Admin Management Flow

```text
Admin login
  -> Buka dashboard NFT
  -> Upload cover/gallery image via POST /api/nfts/upload/image
  -> Simpan URL hasil upload ke form
  -> Create NFT via POST /api/nfts
  -> Preview draft di dashboard admin
  -> Publish via POST /api/nfts/:id/publish
  -> NFT tampil di halaman publik
```

### Admin Edit Media Flow

```text
Admin buka edit NFT
  -> Upload image baru jika diperlukan
  -> Frontend menerima URL upload
  -> Frontend susun image_url dan gallery_urls final
  -> PATCH /api/nfts/:id
  -> gallery_urls lama diganti oleh array baru dari request
```

**Catatan penting:** upload media dan create/update NFT adalah dua proses terpisah. Upload hanya mengembalikan URL. URL tersebut kemudian disimpan melalui `image_url` atau `gallery_urls`.

---

## Data Model

### NFT Catalog Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| nama | string | Yes | Nama NFT yang ditampilkan |
| slug | string | Yes | URL-safe slug, unique, lowercase dengan angka dan tanda hubung |
| deskripsi | text | No | Ringkasan pendek NFT |
| about | text | No | Penjelasan lebih panjang tentang NFT |
| image_url | string | No | URL gambar utama/cover NFT |
| gallery_urls | string[] | No | Array URL gambar galeri |
| blockchain_network | string | Yes | Nama network, contoh `ethereum`, `polygon`, `base` |
| contract_address | string | Yes | Contract address NFT |
| token_id | string | Yes | Token ID NFT |
| token_standard | string | No | Standar token, contoh `ERC721`, `ERC1155` |
| metadata_uri | string | No | URL metadata NFT jika ada |
| marketplace_name | string | No | Nama marketplace, contoh `OpenSea` |
| marketplace_url | string | No | Link eksternal pembelian/listing NFT |
| external_url | string | No | Link eksternal tambahan, misalnya website koleksi |
| prot_id | UUID | No | ID PROT yang terkait, opsional |
| status | enum | Auto | `DRAFT` atau `PUBLISHED`, default `DRAFT` |
| is_active | boolean | Auto | Soft delete flag, default `true` |
| created_by | UUID | Auto | Admin yang membuat NFT |
| updated_by | UUID | Auto | Admin terakhir yang mengubah NFT |
| published_at | timestamp | No | Waktu publish terakhir |
| created_at | timestamp | Auto | Waktu dibuat |
| updated_at | timestamp | Auto | Waktu diupdate |

### Status Enum

| Value | Description |
|-------|-------------|
| `DRAFT` | Belum tampil ke publik |
| `PUBLISHED` | Tampil ke publik |

### Status Flow

```text
[DRAFT] ──publish──▶ [PUBLISHED]
   ▲                     │
   └─────unpublish───────┘
```

### Media Rules

| Field | Behavior |
|-------|----------|
| `image_url` | Satu URL gambar utama. Bisa berasal dari upload endpoint atau URL eksternal. |
| `gallery_urls` | Array final URL galeri. Saat update, array lama diganti oleh array baru. |
| Uploaded files | Disimpan ke S3 folder `images/nfts`. URL bersifat public-read. |
| Delete NFT | Tidak otomatis menghapus file S3. File cleanup dilakukan eksplisit jika dibutuhkan. |

---

## Frontend Types

```typescript
export type NftCatalogStatus = 'DRAFT' | 'PUBLISHED';

export interface NftCatalog {
  id: string;
  nama: string;
  slug: string;
  deskripsi: string | null;
  about: string | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  blockchain_network: string;
  contract_address: string;
  token_id: string;
  token_standard: string | null;
  metadata_uri: string | null;
  marketplace_name: string | null;
  marketplace_url: string | null;
  external_url: string | null;
  prot_id: string | null;
  status: NftCatalogStatus;
  is_active: boolean;
  created_by: string;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  prot?: unknown | null;
}

export interface NftPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface NftListResponse {
  data: NftCatalog[];
  pagination: NftPagination;
}

export interface CreateNftPayload {
  nama: string;
  slug: string;
  deskripsi?: string;
  about?: string;
  image_url?: string;
  gallery_urls?: string[];
  blockchain_network: string;
  contract_address: string;
  token_id: string;
  token_standard?: string;
  metadata_uri?: string;
  marketplace_name?: string;
  marketplace_url?: string;
  external_url?: string;
  prot_id?: string;
}

export type UpdateNftPayload = Partial<CreateNftPayload>;
```

---

## API Endpoints

### 1. List Published NFTs

Mengambil daftar NFT yang sudah `PUBLISHED` dan `is_active = true`.

**Endpoint:** `GET /api/nfts`

**Auth:** Public

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| search | string | No | - | Search di `nama`, `deskripsi`, dan `about` |
| blockchain_network | string | No | - | Filter berdasarkan network |
| prot_id | UUID | No | - | Filter NFT yang terkait PROT tertentu |
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page, max 100 |

**Request Examples:**

```text
GET /api/nfts
GET /api/nfts?page=1&limit=12
GET /api/nfts?search=gasing
GET /api/nfts?blockchain_network=ethereum
GET /api/nfts?prot_id=550e8400-e29b-41d4-a716-446655440000
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nama": "Gasing Heritage NFT",
      "slug": "gasing-heritage-nft",
      "deskripsi": "Katalog NFT tentang permainan rakyat Gasing.",
      "about": "NFT ini menjadi representasi digital untuk arsip budaya Gasing.",
      "image_url": "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/image.png",
      "gallery_urls": [
        "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/gallery-1.png"
      ],
      "blockchain_network": "ethereum",
      "contract_address": "0x123",
      "token_id": "1",
      "token_standard": "ERC721",
      "metadata_uri": "https://example.com/metadata/1",
      "marketplace_name": "OpenSea",
      "marketplace_url": "https://opensea.io/assets/ethereum/0x123/1",
      "external_url": "https://example.com/nft/gasing-heritage-nft",
      "prot_id": null,
      "status": "PUBLISHED",
      "is_active": true,
      "created_by": "admin-uuid",
      "updated_by": "admin-uuid",
      "published_at": "2026-04-22T10:00:00.000Z",
      "created_at": "2026-04-22T09:30:00.000Z",
      "updated_at": "2026-04-22T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 2. Get NFT by ID

Mengambil detail NFT published berdasarkan ID.

**Endpoint:** `GET /api/nfts/:id`

**Auth:** Public

**Response (200):** NFT object

**Errors:**

- `400` - Invalid UUID format
- `404` - NFT tidak ditemukan, belum published, atau sudah inactive

---

### 3. Get NFT by Slug

Mengambil detail NFT published berdasarkan slug.

**Endpoint:** `GET /api/nfts/slug/:slug`

**Auth:** Public

**Request Example:**

```text
GET /api/nfts/slug/gasing-heritage-nft
```

**Response (200):** NFT object

**Errors:**

- `404` - NFT tidak ditemukan, belum published, atau sudah inactive

---

### 4. Upload NFT Image

Upload gambar NFT ke S3 folder `images/nfts`. Endpoint ini bisa dipakai untuk cover image maupun gallery image.

**Endpoint:** `POST /api/nfts/upload/image`

**Auth:** Required, role `admin_kpoti`

**Content-Type:** `multipart/form-data`

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Gambar NFT |

**Accepted MIME Types:** Mengikuti `StorageService`: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.

**Request Example:**

```typescript
const formData = new FormData();
formData.append('file', selectedFile);

const response = await fetch('/api/nfts/upload/image', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
  body: formData,
});

const result = await response.json();
```

**Response (201):**

```json
{
  "url": "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/uuid.png",
  "message": "NFT image uploaded successfully"
}
```

**Frontend Usage:**

- Untuk cover: set `form.image_url = result.url`.
- Untuk gallery: append `result.url` ke local `gallery_urls` state.

**Errors:**

- `400` - No file provided, file terlalu besar, atau MIME type tidak diizinkan
- `401` - Token tidak ada atau invalid
- `403` - Role bukan `admin_kpoti`

---

### 5. Create NFT

Membuat NFT baru sebagai `DRAFT`. NFT belum tampil ke publik sampai dipublish.

**Endpoint:** `POST /api/nfts`

**Auth:** Required, role `admin_kpoti`

**Request Body:**

```json
{
  "nama": "Gasing Heritage NFT",
  "slug": "gasing-heritage-nft",
  "deskripsi": "Katalog NFT tentang permainan rakyat Gasing.",
  "about": "NFT ini menjadi representasi digital untuk arsip budaya Gasing.",
  "image_url": "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/cover.png",
  "gallery_urls": [
    "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/gallery-1.png"
  ],
  "blockchain_network": "ethereum",
  "contract_address": "0x123",
  "token_id": "1",
  "token_standard": "ERC721",
  "metadata_uri": "https://example.com/metadata/1",
  "marketplace_name": "OpenSea",
  "marketplace_url": "https://opensea.io/assets/ethereum/0x123/1",
  "external_url": "https://example.com/nft/gasing-heritage-nft",
  "prot_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Required Fields:**

- `nama`
- `slug`
- `blockchain_network`
- `contract_address`
- `token_id`

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nama": "Gasing Heritage NFT",
  "slug": "gasing-heritage-nft",
  "status": "DRAFT",
  "is_active": true,
  "created_by": "admin-uuid",
  "updated_by": "admin-uuid",
  "published_at": null
}
```

**Errors:**

- `400` - Validation error, URL invalid, `prot_id` tidak valid
- `401` - Unauthorized
- `403` - Role bukan admin
- `409` - Slug duplicate atau blockchain identity duplicate

---

### 6. Update NFT

Update sebagian field NFT. `gallery_urls` dianggap sebagai array final, bukan append otomatis.

**Endpoint:** `PATCH /api/nfts/:id`

**Auth:** Required, role `admin_kpoti`

**Request Body Example:**

```json
{
  "nama": "Gasing Heritage NFT Updated",
  "image_url": "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/new-cover.png",
  "gallery_urls": [
    "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/gallery-new-1.png",
    "https://bucket.s3.ap-southeast-1.amazonaws.com/images/nfts/gallery-new-2.png"
  ],
  "marketplace_url": "https://opensea.io/assets/ethereum/0x123/1"
}
```

**Response (200):** Updated NFT object

**Frontend Gallery Update Rule:**

```typescript
// Existing gallery from server
const currentGallery = nft.gallery_urls ?? [];

// Add uploaded URL locally
const nextGallery = [...currentGallery, uploadedUrl];

// Send final array
await fetch(`/api/nfts/${nft.id}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ gallery_urls: nextGallery }),
});
```

**Errors:**

- `400` - Invalid UUID, validation error, invalid `prot_id`
- `403` - Role bukan admin
- `404` - NFT tidak ditemukan atau inactive
- `409` - Slug duplicate atau blockchain identity duplicate

---

### 7. Publish NFT

Mengubah NFT dari `DRAFT` menjadi `PUBLISHED`, sehingga tampil ke endpoint publik.

**Endpoint:** `POST /api/nfts/:id/publish`

**Auth:** Required, role `admin_kpoti`

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "PUBLISHED",
  "published_at": "2026-04-22T10:00:00.000Z"
}
```

---

### 8. Unpublish NFT

Mengembalikan NFT ke `DRAFT`, sehingga tidak tampil ke publik.

**Endpoint:** `POST /api/nfts/:id/unpublish`

**Auth:** Required, role `admin_kpoti`

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "DRAFT",
  "published_at": null
}
```

---

### 9. Delete NFT

Soft delete NFT dengan `is_active = false`. File S3 tidak otomatis dihapus.

**Endpoint:** `DELETE /api/nfts/:id`

**Auth:** Required, role `admin_kpoti`

**Response:** `204 No Content`

**Errors:**

- `400` - Invalid UUID
- `403` - Role bukan admin
- `404` - NFT tidak ditemukan atau sudah inactive

---

## Recommended Frontend Pages

### Public Pages

| Route | Purpose | API |
|-------|---------|-----|
| `/nfts` | NFT catalog/listing page | `GET /api/nfts` |
| `/nfts/[slug]` | NFT detail page | `GET /api/nfts/slug/:slug` |

### Admin Pages

| Route | Purpose | API |
|-------|---------|-----|
| `/admin/nfts` | NFT management list | Currently use public list for published; admin draft list endpoint is not yet available |
| `/admin/nfts/create` | Create NFT form | `POST /api/nfts`, `POST /api/nfts/upload/image` |
| `/admin/nfts/[id]/edit` | Edit NFT form | `PATCH /api/nfts/:id`, publish/unpublish/delete endpoints |

**Important:** Backend saat ini belum menyediakan endpoint admin list yang menampilkan semua draft dan published. Jika dashboard admin perlu melihat draft, backend perlu endpoint tambahan seperti `GET /api/nfts/admin` atau query admin-aware list.

---

## UI/UX Integration Notes

### Public Catalog Card

Recommended fields:

- `image_url` sebagai thumbnail.
- `nama` sebagai title.
- `deskripsi` sebagai short description.
- `blockchain_network` sebagai badge.
- Link ke `/nfts/[slug]`.

Fallbacks:

- Jika `image_url` kosong, tampilkan placeholder image.
- Jika `deskripsi` kosong, jangan tampilkan empty paragraph.

### Public Detail Page

Recommended sections:

- Hero image from `image_url`.
- Gallery carousel/grid from `gallery_urls`.
- Title and description.
- About section from `about`.
- Blockchain Details:
  - Network
  - Contract Address
  - Token ID
  - Token Standard
  - Metadata URI
- Related PROT section if `prot`/`prot_id` exists.
- External action buttons:
  - `marketplace_url` with label `View on {marketplace_name || 'Marketplace'}`
  - `external_url` with label `Official Link` or similar.

External links should use:

```tsx
<a href={nft.marketplace_url} target="_blank" rel="noreferrer">
  View on {nft.marketplace_name ?? 'Marketplace'}
</a>
```

### Admin Form

Recommended form sections:

1. Basic Information
   - `nama`
   - `slug`
   - `deskripsi`
   - `about`
2. Media
   - Upload cover image
   - Upload gallery images
   - Manual URL input fallback
3. Blockchain Details
   - `blockchain_network`
   - `contract_address`
   - `token_id`
   - `token_standard`
   - `metadata_uri`
4. Marketplace Links
   - `marketplace_name`
   - `marketplace_url`
   - `external_url`
5. Cultural Link
   - Optional `prot_id` selector/search

### Slug Generation

Slug must match:

```regex
^[a-z0-9-]+$
```

Frontend helper example:

```typescript
export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

---

## API Client Examples

### Fetch List

```typescript
export async function getNfts(params?: {
  search?: string;
  blockchain_network?: string;
  prot_id?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const response = await fetch(`/api/nfts?${query.toString()}`);
  if (!response.ok) throw new Error('Failed to load NFTs');
  return response.json() as Promise<NftListResponse>;
}
```

### Upload Image

```typescript
export async function uploadNftImage(file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/nfts/upload/image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Failed to upload NFT image');
  }

  return response.json() as Promise<{ url: string; message: string }>;
}
```

### Create NFT

```typescript
export async function createNft(payload: CreateNftPayload, token: string) {
  const response = await fetch('/api/nfts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Failed to create NFT');
  }

  return response.json() as Promise<NftCatalog>;
}
```

### Publish NFT

```typescript
export async function publishNft(id: string, token: string) {
  const response = await fetch(`/api/nfts/${id}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Failed to publish NFT');
  }

  return response.json() as Promise<NftCatalog>;
}
```

---

## Complete Admin Create Flow Example

```typescript
async function submitNftForm({
  token,
  coverFile,
  galleryFiles,
  values,
}: {
  token: string;
  coverFile?: File;
  galleryFiles: File[];
  values: Omit<CreateNftPayload, 'image_url' | 'gallery_urls'>;
}) {
  let image_url: string | undefined;

  if (coverFile) {
    const coverUpload = await uploadNftImage(coverFile, token);
    image_url = coverUpload.url;
  }

  const gallery_urls: string[] = [];
  for (const file of galleryFiles) {
    const upload = await uploadNftImage(file, token);
    gallery_urls.push(upload.url);
  }

  const nft = await createNft(
    {
      ...values,
      image_url,
      gallery_urls,
    },
    token,
  );

  return nft;
}
```

---

## Permissions

| Role | List Published | Detail Published | Upload Image | Create | Update | Publish | Unpublish | Delete |
|------|----------------|------------------|--------------|--------|--------|---------|-----------|--------|
| `admin_kpoti` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `kurator_daerah` | Yes | Yes | No | No | No | No | No | No |
| `pakar` | Yes | Yes | No | No | No | No | No | No |
| `publik` | Yes | Yes | No | No | No | No | No | No |

---

## Validation Summary

| Field | Rule |
|-------|------|
| `nama` | Required, string, max 200 |
| `slug` | Required, max 200, regex `^[a-z0-9-]+$`, unique |
| `image_url` | Optional valid URL with protocol |
| `gallery_urls` | Optional array of valid URLs with protocol |
| `blockchain_network` | Required, max 100 |
| `contract_address` | Required, max 200 |
| `token_id` | Required, max 200 |
| `token_standard` | Optional, max 50 |
| `marketplace_name` | Optional, max 100 |
| `marketplace_url` | Optional valid URL with protocol |
| `metadata_uri` | Optional valid URL with protocol |
| `external_url` | Optional valid URL with protocol |
| `prot_id` | Optional UUID, must exist if supplied |

Duplicate prevention:

- `slug` must be unique.
- Combination of `blockchain_network + contract_address + token_id` must be unique.

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created or upload success |
| 204 | Delete success with no response body |
| 400 | Bad Request, invalid UUID, validation error, missing upload file, invalid `prot_id` |
| 401 | Unauthorized, missing/invalid token |
| 403 | Forbidden, role is not `admin_kpoti` for admin endpoints |
| 404 | NFT not found, unpublished public access, or inactive NFT |
| 409 | Duplicate slug or duplicate blockchain identity |
| 500 | Internal Server Error |

---

## Migration and Backend Setup Notes

Backend must run migration before frontend uses this module:

```bash
npm run migration:run
```

Required backend storage configuration follows existing S3 config:

```env
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
```

If migration fails because `uuid_generate_v4()` does not exist, enable PostgreSQL extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Known Limitations

- No admin endpoint currently returns all NFTs including drafts. Public list only returns published active NFTs.
- No direct S3 delete is performed when NFT is deleted or media URL is removed from gallery.
- No OpenSea API integration. `marketplace_url` is stored and opened as an external link.
- No wallet, token ownership verification, or blockchain transaction is performed by this module.
