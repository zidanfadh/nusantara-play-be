# Buyer Journey — Marketplace

Alur lengkap seorang pembeli di marketplace Nusantara Play, mulai dari browse produk
hingga pesanan selesai atau dibatalkan.

---

## 1. Browse Produk

Pembeli membuka halaman marketplace dan melihat daftar produk yang aktif.
Filter tersedia berdasarkan nama, kategori, toko, atau PROT terkait.

**Endpoint:**
```
GET /api/marketplace/produk
```

**Query params (semua opsional):**
| Param | Tipe | Keterangan |
|-------|------|------------|
| `search` | string | Cari berdasarkan nama produk |
| `kategori_id` | UUID | Filter berdasarkan kategori |
| `toko_id` | UUID | Filter berdasarkan toko tertentu |
| `prot_id` | UUID | Filter produk yang terkait dengan PROT tertentu |

**Auth:** Tidak diperlukan (`@Public`)

**Contoh request:**
```
GET /api/marketplace/produk?search=congklak&kategori_id=abc-123
```

**Contoh response:**
```json
[
  {
    "id": "prod-uuid",
    "nama": "Set Congklak Kayu",
    "harga": 85000,
    "stok": 12,
    "images": ["https://..."],
    "toko": { "id": "toko-uuid", "nama": "Toko Mainan Nusantara" },
    "kategori": { "id": "kat-uuid", "nama": "Peralatan Permainan" },
    "prots": [{ "id": "prot-uuid", "nama": "Congklak", "jenis": "PERMAINAN_RAKYAT" }]
  }
]
```

---

## 2. Lihat Daftar Kategori

Pembeli bisa melihat semua kategori produk untuk keperluan filter.

**Endpoint:**
```
GET /api/marketplace/kategori
```

**Auth:** Tidak diperlukan (`@Public`)

**Contoh response:**
```json
[
  { "id": "kat-uuid-1", "nama": "Peralatan Permainan", "slug": "peralatan-permainan" },
  { "id": "kat-uuid-2", "nama": "Souvenir", "slug": "souvenir" }
]
```

---

## 3. Lihat Detail Produk

Pembeli memilih satu produk untuk melihat info lengkap termasuk deskripsi,
gambar, stok, harga, info toko, dan PROT terkait.

**Endpoint:**
```
GET /api/marketplace/produk/:id
```

**Auth:** Tidak diperlukan (`@Public`)

**Contoh response:**
```json
{
  "id": "prod-uuid",
  "nama": "Set Congklak Kayu",
  "deskripsi": "Terbuat dari kayu jati pilihan...",
  "harga": 85000,
  "stok": 12,
  "images": ["https://...", "https://..."],
  "is_active": true,
  "toko": {
    "id": "toko-uuid",
    "nama": "Toko Mainan Nusantara",
    "slug": "toko-mainan-nusantara",
    "whatsapp": "08123456789",
    "alamat": "Yogyakarta"
  },
  "kategori": { "id": "kat-uuid", "nama": "Peralatan Permainan" },
  "prots": [
    { "id": "prot-uuid", "nama": "Congklak", "jenis": "PERMAINAN_RAKYAT" }
  ]
}
```

---

## 4. Lihat Halaman Toko

Pembeli mengklik nama toko untuk melihat profil toko dan semua produk di dalamnya.

### 4a. Ambil Info Toko

**Endpoint:**
```
GET /api/marketplace/toko/:id
```

**Auth:** Tidak diperlukan (`@Public`)

### 4b. Ambil Produk Milik Toko

**Endpoint:**
```
GET /api/marketplace/produk?toko_id=<toko-uuid>
```

**Auth:** Tidak diperlukan (`@Public`)

---

## 5. Buat Pesanan (Checkout)

Pembeli memutuskan membeli produk. Pembeli mengisi jumlah, alamat pengiriman,
dan catatan opsional. Sistem otomatis mengurangi stok produk.

> **Catatan:** Pembeli tidak bisa membeli dari toko miliknya sendiri.

**Endpoint:**
```
POST /api/marketplace/order
```

**Auth:** Wajib login

**Request body:**
```json
{
  "toko_id": "toko-uuid",
  "items": [
    { "produk_id": "prod-uuid", "qty": 2 }
  ],
  "shipping_address": {
    "nama_penerima": "Budi Santoso",
    "phone": "08123456789",
    "alamat_lengkap": "Jl. Malioboro No. 1",
    "kota": "Yogyakarta",
    "provinsi": "DI Yogyakarta",
    "kode_pos": "55271"
  },
  "catatan": "Tolong dibungkus rapi"
}
```

**Response (201):**
```json
{
  "id": "order-uuid",
  "status": "menunggu",
  "total_harga": 170000,
  "toko": { "id": "toko-uuid", "nama": "Toko Mainan Nusantara" },
  "items": [
    {
      "produk_id": "prod-uuid",
      "nama_produk": "Set Congklak Kayu",
      "qty": 2,
      "harga_satuan": 85000,
      "subtotal": 170000
    }
  ],
  "shipping_address": { ... },
  "created_at": "2026-03-20T10:00:00Z"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `400` | Stok tidak mencukupi |
| `400` | Pembeli membeli dari toko sendiri |
| `404` | Toko atau produk tidak ditemukan |

---

## 6. Lihat Daftar Pesanan Saya

Pembeli melihat semua pesanan yang pernah dibuat, diurutkan dari terbaru.

**Endpoint:**
```
GET /api/marketplace/order
```

**Auth:** Wajib login (hanya menampilkan pesanan milik user yang login)

**Contoh response:**
```json
[
  {
    "id": "order-uuid",
    "status": "menunggu",
    "total_harga": 170000,
    "toko": { "id": "toko-uuid", "nama": "Toko Mainan Nusantara" },
    "items": [...],
    "created_at": "2026-03-20T10:00:00Z"
  }
]
```

---

## 7. Lihat Detail Pesanan

Pembeli membuka detail satu pesanan untuk melihat status, item, alamat,
dan info pengiriman (jika sudah dikirim).

**Endpoint:**
```
GET /api/marketplace/order/:id
```

**Auth:** Wajib login (hanya pembeli atau penjual dari pesanan tersebut)

**Contoh response saat sudah dikirim:**
```json
{
  "id": "order-uuid",
  "status": "dikirim",
  "total_harga": 170000,
  "kurir_pengiriman": "JNE",
  "nomor_resi": "JNE12345678",
  "shipping_address": { ... },
  "toko": { ... },
  "items": [...]
}
```

---

## 8. Konfirmasi Pesanan Diterima

Setelah barang tiba, pembeli menandai pesanan sebagai selesai.

> **Syarat:** Status harus `dikirim`.

**Endpoint:**
```
PATCH /api/marketplace/order/:id/selesai
```

**Auth:** Wajib login (hanya pembeli dari pesanan ini)

**Response:** Order dengan `status: "selesai"`

---

## 9. Batalkan Pesanan

Pembeli membatalkan pesanan sebelum dikonfirmasi penjual.
Stok produk akan dikembalikan secara otomatis.

> **Syarat:** Status harus `menunggu`.

**Endpoint:**
```
PATCH /api/marketplace/order/:id/batalkan
```

**Auth:** Wajib login (pembeli hanya bisa batalkan saat `menunggu`)

**Response:** Order dengan `status: "dibatalkan"`

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `400` | Status sudah bukan `menunggu` |
| `403` | Bukan pembeli dari pesanan ini |

---

## Ringkasan Flow Pembeli

```
Browse Produk ──────────────────────────────► GET  /produk
     │
     ▼
Lihat Detail Produk ─────────────────────────► GET  /produk/:id
     │
     ├── Lihat Toko ──────────────────────────► GET  /toko/:id
     │
     ▼
Buat Pesanan (Checkout) ─────────────────────► POST /order
     │
     ▼
Pantau Pesanan ──────────────────────────────► GET  /order
     │                                         GET  /order/:id
     │
     ├── Pesanan Diterima ──────────────────── PATCH /order/:id/selesai
     │
     └── Batalkan Pesanan ──────────────────── PATCH /order/:id/batalkan
```
