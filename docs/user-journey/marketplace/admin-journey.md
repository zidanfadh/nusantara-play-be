# Admin Journey — Marketplace

Alur admin (`admin_kpoti`) dalam mengelola data master marketplace,
yaitu kategori produk.

> **Syarat:** User harus login dengan role `admin_kpoti`.

---

## 1. Lihat Semua Kategori

Admin melihat daftar seluruh kategori produk yang sudah ada.

**Endpoint:**
```
GET /api/marketplace/kategori
```

**Auth:** Tidak diperlukan (`@Public`) — siapapun bisa melihat

**Contoh response:**
```json
[
  {
    "id": "kat-uuid-1",
    "nama": "Peralatan Permainan",
    "slug": "peralatan-permainan",
    "deskripsi": "Alat dan perlengkapan untuk memainkan permainan tradisional",
    "created_at": "2026-03-20T08:00:00Z",
    "updated_at": "2026-03-20T08:00:00Z"
  },
  {
    "id": "kat-uuid-2",
    "nama": "Souvenir",
    "slug": "souvenir",
    "deskripsi": null
  }
]
```

---

## 2. Lihat Detail Satu Kategori

**Endpoint:**
```
GET /api/marketplace/kategori/:id
```

**Auth:** Tidak diperlukan (`@Public`)

---

## 3. Tambah Kategori Baru

Admin membuat kategori produk baru.

**Endpoint:**
```
POST /api/marketplace/kategori
```

**Auth:** Wajib login + role `admin_kpoti`

**Request body:**
```json
{
  "nama": "Pakaian Tradisional",
  "slug": "pakaian-tradisional",
  "deskripsi": "Busana dan aksesori pakaian adat Nusantara"
}
```

**Field:**
| Field | Wajib | Keterangan |
|-------|-------|------------|
| `nama` | Ya | Nama kategori (maks 100 karakter) |
| `slug` | Ya | Unik, hanya huruf kecil/angka/tanda hubung |
| `deskripsi` | Tidak | Penjelasan kategori |

**Response (201):**
```json
{
  "id": "kat-uuid-3",
  "nama": "Pakaian Tradisional",
  "slug": "pakaian-tradisional",
  "deskripsi": "Busana dan aksesori pakaian adat Nusantara",
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `403` | User bukan `admin_kpoti` |
| `409` | Slug sudah digunakan kategori lain |

---

## 4. Update Kategori

Admin mengubah nama, slug, atau deskripsi kategori yang sudah ada.

**Endpoint:**
```
PATCH /api/marketplace/kategori/:id
```

**Auth:** Wajib login + role `admin_kpoti`

**Request body** (semua field opsional):
```json
{
  "nama": "Pakaian & Aksesori Tradisional",
  "deskripsi": "Deskripsi yang diperbarui"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `403` | User bukan `admin_kpoti` |
| `404` | Kategori tidak ditemukan |
| `409` | Slug baru sudah digunakan |

---

## 5. Hapus Kategori

Admin menghapus kategori. Produk yang sebelumnya menggunakan kategori ini
akan memiliki `kategori_id = null` (ON DELETE SET NULL).

> **Perhatian:** Hapus hanya kategori yang tidak lagi relevan.
> Produk yang terkait tidak ikut terhapus.

**Endpoint:**
```
DELETE /api/marketplace/kategori/:id
```

**Auth:** Wajib login + role `admin_kpoti`

**Response:** `204 No Content`

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `403` | User bukan `admin_kpoti` |
| `404` | Kategori tidak ditemukan |

---

## Ringkasan Flow Admin

```
Lihat Semua Kategori ────────────────────────► GET    /kategori
     │
     ├── Tambah Kategori Baru ────────────────► POST   /kategori
     │
     ├── Update Kategori ─────────────────────► PATCH  /kategori/:id
     │
     └── Hapus Kategori ──────────────────────► DELETE /kategori/:id
```

---

## Tabel Akses Lengkap — Admin vs Publik

| Endpoint | Publik | Admin |
|----------|--------|-------|
| `GET /kategori` | ✅ | ✅ |
| `GET /kategori/:id` | ✅ | ✅ |
| `POST /kategori` | ❌ | ✅ |
| `PATCH /kategori/:id` | ❌ | ✅ |
| `DELETE /kategori/:id` | ❌ | ✅ |
