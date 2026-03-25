# Seller Journey — Marketplace

Alur lengkap seorang penjual di marketplace Nusantara Play, mulai dari registrasi toko
hingga mengelola produk dan memproses pesanan masuk.

> **Syarat:** User harus sudah login (JWT valid). Setiap user hanya boleh punya **satu toko**.

---

## FASE 1: REGISTRASI TOKO

### 1. Cek Apakah Sudah Punya Toko

Saat user masuk ke halaman "Toko Saya", sistem mengecek apakah user sudah punya toko.

**Endpoint:**
```
GET /api/marketplace/toko/my
```

**Auth:** Wajib login

**Response jika sudah punya toko (200):**
```json
{
  "id": "toko-uuid",
  "nama": "Toko Mainan Nusantara",
  "slug": "toko-mainan-nusantara",
  "is_active": true,
  ...
}
```

**Response jika belum punya toko (404):**
```json
{ "message": "Anda belum memiliki toko" }
```

---

### 2. Daftar Toko Baru

Jika belum punya toko, user mengisi form pendaftaran toko.

**Endpoint:**
```
POST /api/marketplace/toko
```

**Auth:** Wajib login

**Request body:**
```json
{
  "nama": "Toko Mainan Nusantara",
  "slug": "toko-mainan-nusantara",
  "deskripsi": "Menjual peralatan permainan tradisional berkualitas",
  "alamat": "Jl. Malioboro No. 1, Yogyakarta",
  "phone": "0274123456",
  "whatsapp": "08123456789"
}
```

**Field penting:**
| Field | Wajib | Keterangan |
|-------|-------|------------|
| `nama` | Ya | Nama toko (maks 100 karakter) |
| `slug` | Ya | URL-friendly, hanya huruf kecil/angka/tanda hubung |
| `deskripsi` | Tidak | Deskripsi toko |
| `logo_url` | Tidak | URL logo toko (upload dulu via `/api/upload`) |
| `alamat` | Tidak | Alamat lengkap toko |
| `phone` | Tidak | Nomor telepon |
| `whatsapp` | Tidak | Nomor WhatsApp |

**Response (201):**
```json
{
  "id": "toko-uuid",
  "user_id": "user-uuid",
  "nama": "Toko Mainan Nusantara",
  "slug": "toko-mainan-nusantara",
  "is_active": true,
  "created_at": "2026-03-20T10:00:00Z"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `409` | User sudah punya toko |
| `409` | Slug sudah digunakan toko lain |

---

### 3. Update Info Toko

Penjual mengubah info toko (nama, deskripsi, alamat, dll).

**Endpoint:**
```
PATCH /api/marketplace/toko/:id
```

**Auth:** Wajib login + harus owner toko tersebut

**Request body** (semua field opsional):
```json
{
  "deskripsi": "Deskripsi baru yang lebih lengkap",
  "logo_url": "https://cdn.example.com/logo.png",
  "whatsapp": "08199999999"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `403` | User bukan owner toko ini |
| `409` | Slug baru sudah digunakan |

---

## FASE 2: KELOLA PRODUK

### 4. Tambah Produk Baru

Penjual menambahkan produk ke tokonya. Toko otomatis terdeteksi dari user yang login.

**Endpoint:**
```
POST /api/marketplace/produk
```

**Auth:** Wajib login + harus punya toko

**Request body:**
```json
{
  "nama": "Set Congklak Kayu",
  "slug": "set-congklak-kayu",
  "deskripsi": "Terbuat dari kayu jati pilihan, terdiri dari papan + 98 biji.",
  "harga": 85000,
  "stok": 50,
  "kategori_id": "kat-uuid",
  "images": [
    "https://cdn.example.com/congklak-1.jpg",
    "https://cdn.example.com/congklak-2.jpg"
  ]
}
```

**Field penting:**
| Field | Wajib | Keterangan |
|-------|-------|------------|
| `nama` | Ya | Nama produk (maks 200 karakter) |
| `slug` | Ya | Unik dalam satu toko |
| `harga` | Ya | Harga dalam Rupiah (≥ 0) |
| `stok` | Ya | Jumlah stok (≥ 0) |
| `kategori_id` | Tidak | UUID kategori (lihat `GET /kategori`) |
| `images` | Tidak | Array URL gambar (upload dulu via `/api/upload`) |

**Response (201):**
```json
{
  "id": "prod-uuid",
  "toko_id": "toko-uuid",
  "nama": "Set Congklak Kayu",
  "harga": 85000,
  "stok": 50,
  "is_active": true,
  "prots": []
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `404` | User belum punya toko |
| `409` | Slug sudah digunakan di toko ini |

---

### 5. Update Produk

Penjual mengubah data produk (harga, stok, deskripsi, dll).

**Endpoint:**
```
PATCH /api/marketplace/produk/:id
```

**Auth:** Wajib login + harus owner toko produk tersebut

**Request body** (semua field opsional):
```json
{
  "harga": 90000,
  "stok": 45,
  "deskripsi": "Deskripsi yang diperbarui"
}
```

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `403` | User bukan owner produk ini |
| `404` | Produk tidak ditemukan |

---

### 6. Nonaktifkan Produk (Soft Delete)

Penjual menonaktifkan produk (tidak dihapus permanen, hanya `is_active = false`).

**Endpoint:**
```
DELETE /api/marketplace/produk/:id
```

**Auth:** Wajib login + harus owner toko produk tersebut

**Response:** `204 No Content`

---

### 7. Kaitkan Produk dengan PROT

Penjual mengaitkan produk dengan satu atau lebih PROT yang relevan.
Contoh: produk "Set Congklak" dikaitkan dengan PROT "Congklak".

**Endpoint:**
```
POST /api/marketplace/produk/:id/prot
```

**Auth:** Wajib login + harus owner produk

**Request body:**
```json
{ "prot_id": "prot-uuid" }
```

**Response:** Produk lengkap dengan `prots` yang sudah diperbarui.

---

### 8. Hapus Kaitan Produk dengan PROT

**Endpoint:**
```
DELETE /api/marketplace/produk/:id/prot/:protId
```

**Auth:** Wajib login + harus owner produk

**Response:** `204 No Content`

---

## FASE 3: KELOLA PESANAN MASUK

### 9. Lihat Semua Pesanan Masuk

Penjual melihat daftar pesanan yang masuk ke tokonya, diurutkan dari terbaru.

**Endpoint:**
```
GET /api/marketplace/order/seller
```

**Auth:** Wajib login + harus punya toko

**Contoh response:**
```json
[
  {
    "id": "order-uuid",
    "status": "menunggu",
    "total_harga": 170000,
    "buyer": { "id": "user-uuid", "full_name": "Budi Santoso", "email": "budi@..." },
    "items": [
      { "nama_produk": "Set Congklak Kayu", "qty": 2, "subtotal": 170000 }
    ],
    "created_at": "2026-03-20T10:00:00Z"
  }
]
```

---

### 10. Lihat Detail Pesanan

**Endpoint:**
```
GET /api/marketplace/order/:id
```

**Auth:** Wajib login (buyer atau seller dari pesanan ini)

---

### 11. Konfirmasi Pesanan

Penjual menerima dan mengkonfirmasi pesanan. Status berubah dari `menunggu` → `dikonfirmasi`.

> **Syarat:** Status harus `menunggu`.

**Endpoint:**
```
PATCH /api/marketplace/order/:id/konfirmasi
```

**Auth:** Wajib login + harus seller dari pesanan ini

**Response:** Order dengan `status: "dikonfirmasi"`

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `400` | Status bukan `menunggu` |
| `403` | User bukan seller pesanan ini |

---

### 12. Kirim Pesanan

Penjual mengirim barang dan memasukkan info kurir serta nomor resi.
Status berubah dari `dikonfirmasi` → `dikirim`.

> **Syarat:** Status harus `dikonfirmasi`.

**Endpoint:**
```
PATCH /api/marketplace/order/:id/kirim
```

**Auth:** Wajib login + harus seller dari pesanan ini

**Request body:**
```json
{
  "kurir_pengiriman": "JNE",
  "nomor_resi": "JNE12345678"
}
```

**Response:** Order dengan `status: "dikirim"`, `kurir_pengiriman`, dan `nomor_resi` terisi.

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `400` | Status bukan `dikonfirmasi` |
| `403` | User bukan seller pesanan ini |

---

### 13. Batalkan Pesanan (dari sisi Penjual)

Penjual membatalkan pesanan. Stok produk dikembalikan otomatis.

> **Syarat:** Status harus `menunggu` atau `dikonfirmasi`.

**Endpoint:**
```
PATCH /api/marketplace/order/:id/batalkan
```

**Auth:** Wajib login + harus seller dari pesanan ini

**Response:** Order dengan `status: "dibatalkan"`

**Error yang mungkin:**
| Kode | Kondisi |
|------|---------|
| `400` | Status sudah `dikirim`, `selesai`, atau `dibatalkan` |
| `403` | User bukan seller pesanan ini |

---

## Ringkasan Flow Penjual

```
Cek Toko ───────────────────────────────────► GET  /toko/my
     │
     ├── Belum punya toko
     │     └── Daftar Toko ─────────────────► POST /toko
     │
     └── Sudah punya toko
           │
           ├─ KELOLA PRODUK
           │   ├── Tambah Produk ───────────► POST /produk
           │   ├── Update Produk ───────────► PATCH /produk/:id
           │   ├── Nonaktifkan Produk ──────► DELETE /produk/:id
           │   ├── Kaitkan ke PROT ─────────► POST /produk/:id/prot
           │   └── Lepas Kaitan PROT ───────► DELETE /produk/:id/prot/:protId
           │
           └─ KELOLA PESANAN
               ├── Lihat Pesanan Masuk ─────► GET  /order/seller
               ├── Lihat Detail Pesanan ────► GET  /order/:id
               ├── Konfirmasi ──────────────► PATCH /order/:id/konfirmasi
               ├── Kirim (+ resi) ──────────► PATCH /order/:id/kirim
               └── Batalkan ────────────────► PATCH /order/:id/batalkan
```
