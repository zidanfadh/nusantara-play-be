# Marketplace Backend — Design Document

**Date:** 2026-03-20

## Goal

Build an MVP marketplace module for Nusantara Play where any authenticated user can open a
Toko (seller shop), list physical products (optionally linked to PROT records), and buyers
can place orders with basic seller confirmation and shipment tracking. No payment gateway
for MVP.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Product types | Physical products only for MVP |
| PROT relationship | Optional many-to-many (product may link to zero or more PROTs) |
| Who can sell | Any authenticated user — one Toko per user |
| Order flow | Basic: place → confirm → ship → complete (no payment gateway) |
| Product categories | Admin-managed `kategori_produk` table |
| Shipping | Buyer provides address on order; seller provides kurir + nomor resi when shipping |

---

## Data Model

### 6 New Tables

```
kategori_produk     — admin-managed product categories
toko                — seller shop, one per user
produk              — product listing, belongs to toko
produk_prot         — join table: produk ↔ prot (many-to-many, optional)
marketplace_order   — buyer order (named to avoid SQL reserved word)
order_item          — line items with price snapshot at time of order
```

### Entity Relationships

```
User ──< Toko (1:1, one toko per user)
Toko ──< Produk
KategoriProduk ──< Produk (nullable)
Produk >──< PROT  (via produk_prot, optional)
Toko ──< marketplace_order
User ──< marketplace_order (as buyer)
marketplace_order ──< order_item
Produk ──< order_item (snapshot: nama_produk, harga_satuan copied at order time)
```

### Order Status Flow

```
MENUNGGU → DIKONFIRMASI → DIKIRIM → SELESAI
               ↓               ↓
           DIBATALKAN      (buyer/seller can cancel before DIKIRIM)
```

**Cancellation rules:**
- Buyer can cancel: `MENUNGGU` only
- Seller can cancel: `MENUNGGU` or `DIKONFIRMASI`
- Stock is restored on cancellation (in a transaction)

### shipping_address JSONB Shape

```json
{
  "nama_penerima": "string",
  "phone": "string",
  "alamat_lengkap": "string",
  "kota": "string",
  "provinsi": "string",
  "kode_pos": "string (optional)"
}
```

---

## Module Structure

```
src/modules/marketplace/
├── entities/
│   ├── kategori-produk.entity.ts
│   ├── toko.entity.ts
│   ├── produk.entity.ts
│   ├── produk-prot.entity.ts
│   ├── order.entity.ts
│   ├── order-item.entity.ts
│   └── index.ts
├── dto/
│   ├── create-kategori.dto.ts
│   ├── update-kategori.dto.ts
│   ├── create-toko.dto.ts
│   ├── update-toko.dto.ts
│   ├── create-produk.dto.ts
│   ├── update-produk.dto.ts
│   ├── query-produk.dto.ts
│   ├── link-prot.dto.ts
│   ├── create-order.dto.ts
│   └── kirim-order.dto.ts
├── __tests__/
│   ├── kategori-produk.service.spec.ts
│   ├── toko.service.spec.ts
│   ├── produk.service.spec.ts
│   └── order.service.spec.ts
├── kategori-produk.service.ts
├── kategori-produk.controller.ts
├── toko.service.ts
├── toko.controller.ts
├── produk.service.ts
├── produk.controller.ts
├── order.service.ts
├── order.controller.ts
└── marketplace.module.ts
```

---

## API Endpoints

### KategoriProduk

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/marketplace/kategori` | Public |
| GET | `/api/marketplace/kategori/:id` | Public |
| POST | `/api/marketplace/kategori` | `admin_kpoti` |
| PATCH | `/api/marketplace/kategori/:id` | `admin_kpoti` |
| DELETE | `/api/marketplace/kategori/:id` | `admin_kpoti` |

### Toko

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/marketplace/toko` | Public |
| GET | `/api/marketplace/toko/my` | Auth |
| GET | `/api/marketplace/toko/:id` | Public |
| POST | `/api/marketplace/toko` | Auth (any, once per user) |
| PATCH | `/api/marketplace/toko/:id` | Toko owner |

### Produk

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/marketplace/produk` | Public (filter: toko_id, kategori_id, prot_id, search) |
| GET | `/api/marketplace/produk/:id` | Public |
| POST | `/api/marketplace/produk` | Toko owner |
| PATCH | `/api/marketplace/produk/:id` | Toko owner |
| DELETE | `/api/marketplace/produk/:id` | Toko owner (soft delete: is_active=false) |
| POST | `/api/marketplace/produk/:id/prot` | Toko owner |
| DELETE | `/api/marketplace/produk/:id/prot/:protId` | Toko owner |

### Order

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/marketplace/order` | Auth buyer |
| GET | `/api/marketplace/order` | Auth (buyer's own orders) |
| GET | `/api/marketplace/order/seller` | Auth (toko owner's incoming orders) |
| GET | `/api/marketplace/order/:id` | Buyer or toko owner |
| PATCH | `/api/marketplace/order/:id/konfirmasi` | Toko owner |
| PATCH | `/api/marketplace/order/:id/kirim` | Toko owner |
| PATCH | `/api/marketplace/order/:id/selesai` | Buyer |
| PATCH | `/api/marketplace/order/:id/batalkan` | Buyer or toko owner |

---

## Authorization Model

Ownership enforcement is done **in the service layer** (throws `ForbiddenException`)
rather than guards, consistent with the rest of this codebase. No new NestJS guards needed.

| Rule | Enforcement |
|------|-------------|
| One toko per user | `ConflictException` in `TokoService.create()` |
| Product owner = toko owner | Check `produk.toko.user_id === userId` in service |
| Buyer cannot buy from own toko | `BadRequestException` in `OrderService.create()` |
| Order access = buyer or seller | Check both in `OrderService.findOne()` |
| Status transition guards | Explicit status checks in each order action method |

---

## Integration Points

- **No changes to `prot.entity.ts`** — the PROT side gets no back-relation (YAGNI).
- **Images** reuse existing `StorageModule` / S3 — frontend uploads first, passes URLs in DTO.
- **Audit logging** — the global `AuditInterceptor` covers all marketplace endpoints automatically.
- **Migration timestamp** — `1743000000000` (after last migration `1742000000000`).
- `AppModule` only change: add `MarketplaceModule` to imports.
