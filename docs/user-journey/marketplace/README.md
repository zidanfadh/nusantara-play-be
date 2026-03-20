# Marketplace — User Journey

Dokumentasi alur pengguna (user journey) untuk fitur Marketplace Nusantara Play.
Setiap langkah dilengkapi endpoint API yang digunakan.

## Base URL

```
/api/marketplace
```

## Roles yang Terlibat

| Role | Akses |
|------|-------|
| `publik` | Browse produk, lihat detail produk & toko, buat pesanan, kelola pesanan sendiri |
| `any` (punya toko) | Semua akses publik + kelola toko & produk + kelola pesanan masuk |
| `admin_kpoti` | Semua akses + kelola kategori produk |

## Daftar Journey

| File | Aktor | Deskripsi |
|------|-------|-----------|
| [buyer-journey.md](./buyer-journey.md) | Pembeli | Browse → Detail → Checkout → Pantau pesanan |
| [seller-journey.md](./seller-journey.md) | Penjual | Daftar toko → Kelola produk → Kelola pesanan masuk |
| [admin-journey.md](./admin-journey.md) | Admin (`admin_kpoti`) | Kelola kategori produk |

## Order Status Flow

```
MENUNGGU → DIKONFIRMASI → DIKIRIM → SELESAI
               ↓               ↓
                      DIBATALKAN
```

| Status | Siapa yang trigger |
|--------|-------------------|
| `menunggu` | Otomatis saat pembeli buat pesanan |
| `dikonfirmasi` | Penjual |
| `dikirim` | Penjual (wajib isi kurir + nomor resi) |
| `selesai` | Pembeli |
| `dibatalkan` | Pembeli (dari `menunggu`) atau Penjual (dari `menunggu` / `dikonfirmasi`) |
