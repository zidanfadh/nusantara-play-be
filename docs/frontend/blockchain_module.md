# Blockchain Verification Module Documentation

## Overview

Blockchain Verification module secara otomatis menganchor setiap verifikasi PROT yang disetujui ke jaringan Polygon Mumbai sebagai bukti permanen dan tidak dapat diubah. Ketika pakar meng-approve verifikasi, sistem otomatis:

1. Menghitung SHA-256 hash dari konten PROT
2. Menyimpan hash tersebut ke smart contract `ProtVerification` di Polygon Mumbai
3. Menyimpan bukti blockchain ke tabel `blockchain_proof`

Module ini bersifat **internal** (tidak ada endpoint langsung untuk trigger anchoring). Anchoring terjadi otomatis saat `submitReview` dengan status `APPROVED`.

---

## Alur Blockchain Anchoring

```
Pakar → POST /verifikasi/:protId/review (status: APPROVED)
           │
           ├─ 1. Simpan Verifikasi record (APPROVED)
           ├─ 2. Update PROT status → DIVERIFIKASI
           ├─ 3. Hapus dari queue
           └─ 4. [Fire-and-forget] BlockchainService.anchorVerification()
                       │
                       ├─ Ambil fields PROT dari DB
                       ├─ Hitung SHA-256 hash (13 fields, sorted)
                       ├─ Buat blockchain_proof row (status: pending)
                       ├─ Kirim ke smart contract recordVerification()
                       └─ Update blockchain_proof: tx_hash, block_number, status: confirmed
```

**Catatan:** Anchoring bersifat async dan tidak memblokir response. Jika gagal, scheduler akan retry otomatis setiap 5 menit (max 3 kali).

---

## Data Model

### BlockchainProof Entity

| Field               | Type      | Description                                                    |
| ------------------- | --------- | -------------------------------------------------------------- |
| id                  | UUID      | Primary key                                                    |
| verifikasi_id       | UUID      | FK ke tabel `verifikasi`                                       |
| prot_id             | UUID      | FK ke tabel `prot`                                             |
| version             | integer   | Nomor versi on-chain (increment setiap re-verifikasi)          |
| data_hash           | text      | SHA-256 hex string dari konten PROT saat verifikasi            |
| tx_hash             | text/null | Transaction hash di Polygon (null sampai dikonfirmasi)         |
| block_number        | text/null | Block number transaksi (disimpan sebagai string untuk bigint)  |
| blockchain_network  | text      | Network identifier, default: `polygon-mumbai`                  |
| status              | text      | `pending` \| `confirmed` \| `failed`                           |
| retry_count         | integer   | Jumlah percobaan (max 3)                                       |
| last_error          | text/null | Pesan error terakhir jika gagal                                |
| anchored_at         | timestamp | Waktu transaksi dikonfirmasi di blockchain                     |
| created_at          | timestamp | Waktu record dibuat                                            |
| updated_at          | timestamp | Waktu record diupdate                                          |

### BlockchainProofStatus

| Value       | Description                                         |
| ----------- | --------------------------------------------------- |
| `pending`   | Transaksi sedang dikirim / menunggu retry           |
| `confirmed` | Transaksi berhasil dikonfirmasi di blockchain       |
| `failed`    | Gagal setelah 3 percobaan, perlu intervensi manual  |

---

## Fields yang Di-hash

Hash SHA-256 dihitung dari 13 field konten PROT berikut (keys diurutkan alfabetis sebelum di-stringify):

| Field           | Catatan                                                       |
| --------------- | ------------------------------------------------------------- |
| `caraBermain`   |                                                               |
| `deskripsi`     |                                                               |
| `desaKode`      |                                                               |
| `jenis`         | enum: `PERMAINAN_RAKYAT` / `OLAHRAGA_TRADISIONAL`             |
| `jumlahPemain`  |                                                               |
| `kabkotaKode`   |                                                               |
| `kecamatanKode` |                                                               |
| `nama`          |                                                               |
| `nilaiMoral`    |                                                               |
| `peralatan`     | **URL media (`fotoAlat`, `urlPembelian`) di-strip sebelum hash** |
| `provinsiKode`  |                                                               |
| `statusAsalUsul`|                                                               |
| `targetUsia`    | enum: `ANAK` / `REMAJA` / `DEWASA` / `SEMUA_USIA`            |

Field yang **tidak** dimasukkan ke hash: `fotoKegiatan`, `videoKegiatan`, `dokumenKurikulum`, `alamatLengkap`, dan semua field metadata (timestamps, IDs).

---

## Versi dan Re-verifikasi

Jika PROT diedit dan diverifikasi ulang, smart contract menyimpan record baru dengan `version` yang lebih tinggi. Record lama tetap ada di blockchain secara permanen.

```
Verifikasi pertama  → version 1 (on-chain)
Edit + re-verifikasi → version 2 (on-chain)
Edit + re-verifikasi → version 3 (on-chain)
```

Tabel `blockchain_proof` juga menyimpan semua versi dengan constraint `UNIQUE (prot_id, version)`.

---

## Integrity Check

`BlockchainService.checkIntegrity(protId)` dapat dipanggil secara internal untuk memverifikasi integritas data:

```typescript
// Return shape
{
  dbIntact: boolean,      // Hash DB saat ini === hash saat verifikasi
  chainIntact: boolean,   // Hash on-chain === hash saat ini di DB
  fullyVerified: boolean, // dbIntact && chainIntact
  details: {
    storedHash: string | null,   // Hash yang tersimpan di blockchain_proof
    currentHash: string,         // Hash yang baru dihitung dari data DB saat ini
    onChainHash: string | null,  // Hash yang ada di smart contract
    status: string | null,       // Status blockchain_proof terbaru
    txHash: string | null,
    blockNumber: string | null,
  }
}
```

| Flag            | `true` artinya                                             | `false` artinya                                        |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `dbIntact`      | Data DB tidak berubah sejak verifikasi                    | Data DB telah dimodifikasi setelah diverifikasi        |
| `chainIntact`   | Data DB saat ini cocok dengan yang tersimpan di blockchain | Data tidak cocok dengan bukti on-chain                |
| `fullyVerified` | Data utuh dari DB sampai blockchain                       | Ada perubahan atau masalah di salah satu sisi          |

---

## Smart Contract

**Contract:** `ProtVerification.sol`
**Network:** Polygon Mumbai Testnet
**Address:** Diset via env var `BLOCKCHAIN_CONTRACT_ADDRESS`

### Functions

```solidity
// Anchor verifikasi (dipanggil oleh backend wallet)
function recordVerification(string calldata protId, bytes32 dataHash)
  external returns (uint32 version)

// Ambil record verifikasi tertentu
function getRecord(string calldata protId, uint32 version)
  external view returns (VerificationRecord memory)

// Ambil verifikasi terbaru untuk suatu PROT
function getLatest(string calldata protId)
  external view returns (VerificationRecord memory)
```

### VerificationRecord Struct

```solidity
struct VerificationRecord {
  string  protId;      // Supabase UUID dari PROT
  uint32  version;     // Nomor versi (mulai dari 1)
  bytes32 dataHash;    // SHA-256 hash konten PROT
  address verifier;    // Alamat wallet backend
  uint256 timestamp;   // block.timestamp saat anchoring
}
```

---

## Environment Variables

| Variable                      | Deskripsi                                                     |
| ----------------------------- | ------------------------------------------------------------- |
| `BLOCKCHAIN_RPC_URL`          | RPC endpoint Polygon Mumbai (Alchemy/Infura direkomendasikan) |
| `BLOCKCHAIN_PRIVATE_KEY`      | Private key wallet backend (simpan di `.env`, jangan commit!) |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | Alamat contract setelah deploy                                |
| `BLOCKCHAIN_NETWORK`          | Identifier network, default: `polygon-mumbai`                 |

---

## Behavior Jika Blockchain Tidak Dikonfigurasi

Jika env vars tidak diset, `BlockchainService` akan log warning dan tetap inactive. Semua fitur verifikasi PROT tetap berjalan normal — hanya proses anchoring blockchain yang dilewati. Ini memudahkan development lokal tanpa perlu koneksi blockchain.

```
[BlockchainService] Blockchain env vars not configured. BlockchainService will be inactive.
```
