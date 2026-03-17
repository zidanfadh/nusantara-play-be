# Blockchain Verification - Next Steps

**Status:** Core Blockchain Verification module implementation is **COMPLETE** ✅

**Date:** 2026-03-17

---

## Completed ✅

- Smart contract `ProtVerification.sol` (Solidity 0.8.20) dengan versioning
- Hardhat workspace terisolasi di `backend/blockchain/`
- Contract tests — 5/5 passing
- DB migration `blockchain_proof` table
- `BlockchainService` — hash, anchor, integrity check, retry
- `BlockchainScheduler` — retry otomatis setiap 5 menit
- Wiring ke `VerifikasiService` (fire-and-forget saat APPROVED)
- Frontend docs & Postman collection

---

## Step 1 — Deploy Contract ke Polygon Mumbai (WAJIB)

**Status:** ❌ Belum dilakukan
**Estimated Time:** 30 menit

### 1.1 Siapkan wallet

Buat wallet baru khusus untuk backend (jangan pakai wallet pribadi):

```bash
# Cara cepat: pakai cast dari Foundry, atau generate di MetaMask
# Simpan private key dengan aman — ini akan diset di env server
```

### 1.2 Isi MATIC testnet

Pergi ke faucet dan minta MATIC untuk address wallet baru:

- **Faucet:** https://faucet.polygon.technology/
- Pilih network: **Mumbai**
- Paste address wallet → klik Submit
- Tunggu ~1 menit, cek di https://mumbai.polygonscan.com/

### 1.3 Setup .env di backend/blockchain/

```bash
cd backend/blockchain
cp .env.example .env
```

Edit `backend/blockchain/.env`:

```env
PRIVATE_KEY=0x_private_key_wallet_backend_kamu
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

> **Rekomendasi:** Daftar di https://alchemy.com untuk RPC yang lebih stabil daripada public endpoint.

### 1.4 Deploy

```bash
cd backend/blockchain
npm run deploy:mumbai
```

Output yang diharapkan:
```
Deploying with account: 0x...
ProtVerification deployed to: 0xABC123...
Set BLOCKCHAIN_CONTRACT_ADDRESS=0xABC123... in your backend .env
```

**Simpan address contract ini** — akan dipakai di step berikutnya.

### 1.5 Catat address contract

Tambahkan ke `docs/blockchain-next-steps.md` atau README:

```
Contract deployed (Mumbai): 0xABC123...
Deploy date: 2026-03-17
Deployer wallet: 0x...
```

---

## Step 2 — Set Environment Variables di Server (WAJIB)

**Status:** ❌ Belum dilakukan
**Estimated Time:** 10 menit

Tambahkan ke file `.env` di server (bukan di repo):

```env
# Blockchain
BLOCKCHAIN_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BLOCKCHAIN_PRIVATE_KEY=0x_private_key_wallet_backend
BLOCKCHAIN_CONTRACT_ADDRESS=0x_address_dari_step_1
BLOCKCHAIN_NETWORK=polygon-mumbai
```

Jika deploy ke VPS (lihat `docs/deployment-vps.md`), tambahkan ke file env di server dan restart service:

```bash
# Di server
nano /etc/environment  # atau lokasi .env sesuai setup
systemctl restart nusantara-play-backend
```

**Verifikasi:** Cek log server setelah restart, harus ada:
```
[BlockchainService] BlockchainService initialized. Contract: 0xABC123...
```

Jika masih muncul warning `Blockchain env vars not configured` berarti env belum terbaca.

---

## Step 3 — Smoke Test End-to-End (WAJIB)

**Status:** ❌ Belum dilakukan
**Estimated Time:** 30 menit

Setelah deploy contract dan set env, lakukan test alur penuh:

### 3.1 Jalankan server lokal dengan env blockchain

```bash
# Set env lokal dulu (atau pakai localhost Hardhat — lihat Step 3A di bawah)
npm run start:dev
```

### 3.2 Test alur verifikasi via Postman

1. Login sebagai **kurator** → buat PROT baru (status: DRAFT)
2. Submit PROT untuk kurasi (status: DIKURASI)
3. Login sebagai **pakar** → pick dari queue
4. Submit review dengan `status: APPROVED`
5. Cek response — harus langsung kembali (tidak menunggu blockchain)

### 3.3 Cek blockchain_proof table

Segera setelah step 4, query database:

```sql
SELECT id, prot_id, status, tx_hash, block_number, retry_count, last_error
FROM blockchain_proof
ORDER BY created_at DESC
LIMIT 5;
```

Yang diharapkan:
- Baris baru muncul dengan `status = pending` atau `confirmed`
- Dalam ~30 detik, `status` berubah ke `confirmed`
- `tx_hash` terisi (format: `0x...`)
- `block_number` terisi

### 3.4 Verifikasi on-chain

Buka `tx_hash` di Mumbai explorer:

```
https://mumbai.polygonscan.com/tx/0xTX_HASH_DISINI
```

Harus ada transaksi ke contract address dengan function `recordVerification`.

---

## Step 3A — Alternatif: Test Lokal dengan Hardhat Node

**Jika belum mau deploy ke Mumbai**, test dengan local Hardhat node dulu:

```bash
# Terminal 1 — jalankan local blockchain node
cd backend/blockchain
npx hardhat node

# Terminal 2 — deploy ke local node
cd backend/blockchain
npm run deploy:local
# Catat address yang muncul
```

Set `.env` backend (root):

```env
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BLOCKCHAIN_CONTRACT_ADDRESS=0x_address_dari_deploy_local
BLOCKCHAIN_NETWORK=localhost
```

> `0xac0974...` adalah Hardhat account #0 default — **HANYA untuk local testing**.

```bash
# Terminal 3 — jalankan backend
npm run start:dev
```

---

## Step 4 — HTTP Endpoint untuk Integrity Check (Opsional, Recommended)

**Status:** 📋 Belum dibangun
**Estimated Time:** 1-2 jam

Saat ini `BlockchainService.checkIntegrity()` hanya bisa dipanggil secara internal. Untuk frontend bisa menampilkan badge verifikasi blockchain, perlu endpoint HTTP.

### Endpoint yang perlu ditambahkan

```
GET /prot/:id/blockchain-proof
```

**Response:**

```json
{
  "protId": "uuid",
  "status": "confirmed",
  "version": 1,
  "txHash": "0x...",
  "blockNumber": "12345678",
  "network": "polygon-mumbai",
  "anchoredAt": "2026-03-17T10:00:05.000Z",
  "integrity": {
    "dbIntact": true,
    "chainIntact": true,
    "fullyVerified": true
  }
}
```

### File yang perlu dibuat/dimodifikasi

```
src/modules/blockchain/
├── blockchain.controller.ts    ← BUAT BARU
├── dto/
│   └── blockchain-proof.dto.ts ← BUAT BARU
└── blockchain.module.ts        ← tambahkan controller
```

**Controller skeleton:**

```typescript
@Controller('prot')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get(':id/blockchain-proof')
  @Public() // bisa diakses publik untuk verifikasi
  async getBlockchainProof(@Param('id') protId: string) {
    return this.blockchainService.checkIntegrity(protId);
  }
}
```

---

## Step 5 — Mainnet Migration (Opsional, untuk Production)

**Status:** 📋 Belum waktunya

Ketika aplikasi siap production, pindahkan dari Mumbai testnet ke Polygon Mainnet.

### Perubahan yang diperlukan

1. **Deploy ulang contract ke Polygon Mainnet:**

```bash
# Tambahkan network di hardhat.config.ts
polygon: {
  url: process.env.POLYGON_RPC_URL || '',
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
},

# Deploy
npx hardhat run scripts/deploy.ts --network polygon
```

2. **Update env vars di server:**

```env
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BLOCKCHAIN_CONTRACT_ADDRESS=0x_mainnet_contract_address
BLOCKCHAIN_NETWORK=polygon-mainnet
```

3. **Isi MATIC real** di wallet backend (beli di exchange)

4. **Update explorer links** di frontend dari `mumbai.polygonscan.com` ke `polygonscan.com`

> **Catatan:** PROT yang sudah dianchor di testnet tidak bisa dimigrate ke mainnet. Verifikasi baru akan mulai dari mainnet. Pertimbangkan ini saat menentukan timing.

---

## Step 6 — Monitoring & Alerting (Opsional)

**Status:** 📋 Belum dibangun
**Estimated Time:** 2-3 jam

### 6.1 Alert untuk anchoring yang gagal

Tambahkan notifikasi ke admin jika ada `blockchain_proof` dengan `status = failed`:

```typescript
// Di BlockchainScheduler, setelah retry gagal:
// Kirim notifikasi ke admin_kpoti
```

### 6.2 Dashboard status anchoring

Query untuk monitoring di Supabase:

```sql
-- Ringkasan status
SELECT status, COUNT(*), AVG(retry_count)
FROM blockchain_proof
GROUP BY status;

-- Failed dalam 24 jam terakhir
SELECT * FROM blockchain_proof
WHERE status = 'failed'
AND updated_at > NOW() - INTERVAL '24 hours';
```

### 6.3 Scheduled integrity audit

Jalankan `checkIntegrity` secara berkala untuk semua PROT yang sudah DIVERIFIKASI dan bandingkan hasilnya.

---

## Checklist Sebelum Production

```
[ ] Step 1: Contract sudah deploy ke Mumbai — address tersimpan
[ ] Step 2: Env vars terset di server production
[ ] Step 3: Smoke test berhasil — tx_hash tersimpan di DB
[ ] Step 3: Transaksi terlihat di Mumbai explorer
[ ] Step 4: Endpoint /prot/:id/blockchain-proof tersedia (opsional)
[ ] Wallet backend punya MATIC cukup untuk operasional
[ ] Private key wallet backend tersimpan aman (vault/secrets manager)
[ ] Monitor blockchain_proof untuk failed rows secara berkala
```

---

## File Locations

| Item | Lokasi |
|------|--------|
| Smart contract | `backend/blockchain/contracts/ProtVerification.sol` |
| Hardhat workspace | `backend/blockchain/` |
| BlockchainService | `src/modules/blockchain/blockchain.service.ts` |
| BlockchainScheduler | `src/modules/blockchain/blockchain.scheduler.ts` |
| BlockchainModule | `src/modules/blockchain/blockchain.module.ts` |
| Entity | `src/modules/blockchain/entities/blockchain-proof.entity.ts` |
| Migration | `src/migrations/1742000000000-AddBlockchainProof.ts` |
| ABI | `src/modules/blockchain/abi/ProtVerification.json` |
| TypeChain types | `backend/blockchain/typechain-types/` |
| Frontend docs | `docs/frontend/blockchain_module.md` |
| Postman | `docs/postman/Nusantara_Play_Blockchain_API.postman_collection.json` |
| Implementation plan | `docs/plans/2026-03-17-blockchain-verification.md` |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Selesai |
| 📋 | TODO / Opsional |
| ❌ | Wajib tapi belum dilakukan |

**Overall Progress:** Kode selesai. Butuh **deploy + set env** sebelum bisa berjalan di server.
