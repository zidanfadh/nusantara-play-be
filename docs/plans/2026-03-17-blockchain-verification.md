# Blockchain Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Anchor every approved PROT verification to Polygon Mumbai blockchain as immutable proof, with a SHA-256 hash of the game record's content fields stored on-chain.

**Architecture:** When `VerifikasiService.submitReview()` approves a PROT, it fires an async (non-blocking) call to `BlockchainService.anchorVerification()`. That service computes a deterministic SHA-256 hash of the PROT's core content fields, calls a Solidity smart contract on Polygon Mumbai, and stores the resulting tx_hash/block_number back in a new `blockchain_proof` table. A scheduler retries failed rows every 5 minutes (max 3 retries). A separate `checkIntegrity()` function re-computes the hash and compares it against on-chain data.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL (Supabase), ethers.js ^6, Hardhat ^2.22, Solidity ^0.8.20, Polygon Mumbai testnet.

---

## Reference: Existing Verification Flow

The trigger point is `src/modules/prot/verifikasi.service.ts:173-196`.
When `reviewDto.status === VerifikasiStatus.APPROVED`:
- `prot.status` → `PROTStatus.DIVERIFIKASI`
- `prot.verified_by` / `prot.verified_at` are set
- `protRepository.save(prot)` is called
- **This is where we add the fire-and-forget blockchain call.**

Fields to hash from `prot` table (Option A — content only, no media URLs):
`nama, jenis, deskripsi, caraBermain, nilaiMoral, targetUsia, peralatan, statusAsalUsul, provinsiKode, kabkotaKode, kecamatanKode, desaKode, jumlahPemain`

---

## Task 1: Hardhat Workspace Setup

**Files:**
- Create: `backend/blockchain/package.json`
- Create: `backend/blockchain/hardhat.config.ts`
- Create: `backend/blockchain/tsconfig.json`
- Create: `backend/blockchain/.env.example`
- Create: `backend/blockchain/.gitignore`

**Step 1: Create the directory and package.json**

```bash
mkdir -p backend/blockchain
```

`backend/blockchain/package.json`:
```json
{
  "name": "nusantara-blockchain",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:mumbai": "hardhat run scripts/deploy.ts --network mumbai",
    "deploy:local": "hardhat run scripts/deploy.ts --network localhost"
  },
  "devDependencies": {
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create hardhat.config.ts**

`backend/blockchain/hardhat.config.ts`:
```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.20',
  networks: {
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
};

export default config;
```

**Step 3: Create tsconfig.json**

`backend/blockchain/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "resolveJsonModule": true
  },
  "include": ["hardhat.config.ts", "scripts/**/*", "test/**/*"]
}
```

**Step 4: Create .env.example**

`backend/blockchain/.env.example`:
```
PRIVATE_KEY=0x_your_private_key_here
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
```

**Step 5: Create .gitignore**

`backend/blockchain/.gitignore`:
```
node_modules/
artifacts/
cache/
.env
dist/
```

**Step 6: Install dependencies**

```bash
cd backend/blockchain && npm install
```

Expected: `node_modules/` created, no errors.

**Step 7: Commit**

```bash
git add backend/blockchain/
git commit -m "feat(blockchain): add hardhat workspace scaffold"
```

---

## Task 2: Smart Contract

**Files:**
- Create: `backend/blockchain/contracts/ProtVerification.sol`
- Create: `backend/blockchain/test/ProtVerification.test.ts`

**Step 1: Write the contract**

`backend/blockchain/contracts/ProtVerification.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProtVerification {
    struct VerificationRecord {
        string  protId;
        uint32  version;
        bytes32 dataHash;
        address verifier;
        uint256 timestamp;
    }

    // protId => version => record
    mapping(string => mapping(uint32 => VerificationRecord)) public records;
    // protId => latest version number
    mapping(string => uint32) public latestVersion;

    event VerificationAnchored(
        string indexed protId,
        uint32 version,
        bytes32 dataHash,
        address indexed verifier,
        uint256 timestamp
    );

    function recordVerification(
        string calldata protId,
        bytes32 dataHash
    ) external returns (uint32 version) {
        version = latestVersion[protId] + 1;
        latestVersion[protId] = version;
        records[protId][version] = VerificationRecord({
            protId: protId,
            version: version,
            dataHash: dataHash,
            verifier: msg.sender,
            timestamp: block.timestamp
        });
        emit VerificationAnchored(protId, version, dataHash, msg.sender, block.timestamp);
    }

    function getRecord(
        string calldata protId,
        uint32 version
    ) external view returns (VerificationRecord memory) {
        return records[protId][version];
    }

    function getLatest(
        string calldata protId
    ) external view returns (VerificationRecord memory) {
        uint32 v = latestVersion[protId];
        require(v > 0, 'No record found');
        return records[protId][v];
    }
}
```

**Step 2: Write contract tests**

`backend/blockchain/test/ProtVerification.test.ts`:
```typescript
import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('ProtVerification', function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('ProtVerification');
    const contract = await factory.deploy();
    return { contract, owner, otherAccount };
  }

  it('records a verification and increments version', async function () {
    const { contract, owner } = await deployFixture();
    const protId = '550e8400-e29b-41d4-a716-446655440000';
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('test-data'));

    await expect(contract.recordVerification(protId, dataHash))
      .to.emit(contract, 'VerificationAnchored')
      .withArgs(protId, 1, dataHash, owner.address, ethers.toBigInt(0));

    expect(await contract.latestVersion(protId)).to.equal(1);
  });

  it('supports re-verification with incrementing versions', async function () {
    const { contract } = await deployFixture();
    const protId = '550e8400-e29b-41d4-a716-446655440000';
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('v1'));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('v2'));

    await contract.recordVerification(protId, hash1);
    await contract.recordVerification(protId, hash2);

    expect(await contract.latestVersion(protId)).to.equal(2);
    const record1 = await contract.getRecord(protId, 1);
    const record2 = await contract.getRecord(protId, 2);
    expect(record1.dataHash).to.equal(hash1);
    expect(record2.dataHash).to.equal(hash2);
  });

  it('getLatest returns the most recent record', async function () {
    const { contract } = await deployFixture();
    const protId = 'test-uuid-latest';
    const hash = ethers.keccak256(ethers.toUtf8Bytes('latest'));

    await contract.recordVerification(protId, hash);
    const latest = await contract.getLatest(protId);
    expect(latest.dataHash).to.equal(hash);
    expect(latest.version).to.equal(1);
  });

  it('getLatest reverts when no record exists', async function () {
    const { contract } = await deployFixture();
    await expect(contract.getLatest('nonexistent')).to.be.revertedWith('No record found');
  });

  it('keeps old records immutable after re-verification', async function () {
    const { contract } = await deployFixture();
    const protId = 'immutable-test';
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('original'));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('updated'));

    await contract.recordVerification(protId, hash1);
    await contract.recordVerification(protId, hash2);

    const original = await contract.getRecord(protId, 1);
    expect(original.dataHash).to.equal(hash1);
  });
});
```

**Step 3: Run tests**

```bash
cd backend/blockchain && npm test
```

Expected: 5 passing tests.

**Step 4: Commit**

```bash
git add backend/blockchain/contracts/ backend/blockchain/test/
git commit -m "feat(blockchain): add ProtVerification smart contract with tests"
```

---

## Task 3: Deploy Script

**Files:**
- Create: `backend/blockchain/scripts/deploy.ts`

**Step 1: Write deploy script**

`backend/blockchain/scripts/deploy.ts`:
```typescript
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const factory = await ethers.getContractFactory('ProtVerification');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('ProtVerification deployed to:', address);
  console.log('Set BLOCKCHAIN_CONTRACT_ADDRESS=' + address + ' in your backend .env');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Compile to verify no Solidity errors**

```bash
cd backend/blockchain && npm run compile
```

Expected: `Compiled 1 Solidity file successfully`.

**Step 3: Commit**

```bash
git add backend/blockchain/scripts/
git commit -m "feat(blockchain): add deploy script"
```

---

## Task 4: Copy ABI into NestJS

After compiling, the ABI lives at:
`backend/blockchain/artifacts/contracts/ProtVerification.sol/ProtVerification.json`

**Files:**
- Create: `src/modules/blockchain/abi/ProtVerification.json` (copy from artifacts)

**Step 1: Copy the ABI**

```bash
mkdir -p src/modules/blockchain/abi
cp backend/blockchain/artifacts/contracts/ProtVerification.sol/ProtVerification.json \
   src/modules/blockchain/abi/ProtVerification.json
```

**Step 2: Verify the file contains `"abi": [...]`**

Check that `src/modules/blockchain/abi/ProtVerification.json` exists and has an `abi` array.

**Step 3: Commit**

```bash
git add src/modules/blockchain/abi/
git commit -m "feat(blockchain): add compiled ABI to NestJS module"
```

---

## Task 5: Add ethers.js to main backend

**Files:**
- Modify: `package.json`

**Step 1: Install ethers**

```bash
npm install ethers@^6
```

**Step 2: Verify package.json has `"ethers": "^6.x.x"` in dependencies**

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(blockchain): add ethers.js dependency"
```

---

## Task 6: Database Migration — blockchain_proof table

**Files:**
- Create: `src/migrations/<timestamp>-AddBlockchainProof.ts`

Use timestamp: `1742000000000`

**Step 1: Write the migration**

`src/migrations/1742000000000-AddBlockchainProof.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockchainProof1742000000000 implements MigrationInterface {
  name = 'AddBlockchainProof1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE blockchain_proof (
        id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        verifikasi_id      uuid NOT NULL REFERENCES verifikasi(id) ON DELETE CASCADE,
        prot_id            uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        version            integer NOT NULL,
        data_hash          text NOT NULL,
        tx_hash            text,
        block_number       bigint,
        blockchain_network text NOT NULL DEFAULT 'polygon-mumbai',
        status             text NOT NULL DEFAULT 'pending',
        retry_count        integer NOT NULL DEFAULT 0,
        last_error         text,
        anchored_at        timestamp,
        created_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (prot_id, version)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_blockchain_proof_verifikasi ON blockchain_proof(verifikasi_id);
      CREATE INDEX idx_blockchain_proof_prot       ON blockchain_proof(prot_id);
      CREATE INDEX idx_blockchain_proof_status     ON blockchain_proof(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS blockchain_proof CASCADE`);
  }
}
```

**Step 2: Run the migration**

```bash
npm run migration:run
```

Expected: `Migration AddBlockchainProof1742000000000 has been executed successfully`.

**Step 3: Commit**

```bash
git add src/migrations/
git commit -m "feat(blockchain): add blockchain_proof migration"
```

---

## Task 7: BlockchainProof Entity

**Files:**
- Create: `src/modules/blockchain/entities/blockchain-proof.entity.ts`

**Step 1: Write the entity**

`src/modules/blockchain/entities/blockchain-proof.entity.ts`:
```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PROT } from '../../prot/entities/prot.entity';
import { Verifikasi } from '../../prot/entities/verifikasi.entity';

export enum BlockchainProofStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('blockchain_proof')
export class BlockchainProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'verifikasi_id' })
  verifikasi_id: string;

  @Column({ type: 'uuid', name: 'prot_id' })
  prot_id: string;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'text', name: 'data_hash' })
  data_hash: string;

  @Column({ type: 'text', nullable: true, name: 'tx_hash' })
  tx_hash: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'block_number' })
  block_number: number | null;

  @Column({ type: 'text', name: 'blockchain_network', default: 'polygon-mumbai' })
  blockchain_network: string;

  @Column({ type: 'text', default: BlockchainProofStatus.PENDING })
  status: BlockchainProofStatus;

  @Column({ type: 'integer', default: 0, name: 'retry_count' })
  retry_count: number;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  last_error: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'anchored_at' })
  anchored_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Verifikasi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verifikasi_id' })
  verifikasi: Verifikasi;

  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;
}
```

**Step 2: Commit**

```bash
git add src/modules/blockchain/entities/
git commit -m "feat(blockchain): add BlockchainProof entity"
```

---

## Task 8: BlockchainService

**Files:**
- Create: `src/modules/blockchain/blockchain.service.ts`

**Step 1: Write the service**

`src/modules/blockchain/blockchain.service.ts`:
```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import {
  BlockchainProof,
  BlockchainProofStatus,
} from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';
import * as ProtVerificationABI from './abi/ProtVerification.json';

// Fields included in the content hash — stable content only, no media URLs
const HASH_FIELDS: (keyof PROT)[] = [
  'nama',
  'jenis',
  'deskripsi',
  'caraBermain',
  'nilaiMoral',
  'targetUsia',
  'peralatan',
  'statusAsalUsul',
  'provinsiKode',
  'kabkotaKode',
  'kecamatanKode',
  'desaKode',
  'jumlahPemain',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor(
    @InjectRepository(BlockchainProof)
    private readonly proofRepository: Repository<BlockchainProof>,
    @InjectRepository(Verifikasi)
    private readonly verifikasiRepository: Repository<Verifikasi>,
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey = this.configService.get<string>('BLOCKCHAIN_PRIVATE_KEY');
    const contractAddress = this.configService.get<string>('BLOCKCHAIN_CONTRACT_ADDRESS');

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn(
        'Blockchain env vars not configured. BlockchainService will be inactive.',
      );
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(
      contractAddress,
      ProtVerificationABI.abi,
      this.wallet,
    );
    this.logger.log(`BlockchainService initialized. Contract: ${contractAddress}`);
  }

  /**
   * Compute deterministic SHA-256 hash of PROT content fields.
   * Keys are sorted alphabetically before stringification.
   */
  computeHash(prot: PROT): string {
    const payload: Record<string, unknown> = {};
    for (const field of HASH_FIELDS.sort()) {
      payload[field] = prot[field] ?? null;
    }
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Fire-and-forget: called after verification approval.
   * Creates a pending proof row, then anchors to chain.
   */
  async anchorVerification(verifikasiId: string): Promise<void> {
    const verifikasi = await this.verifikasiRepository.findOne({
      where: { id: verifikasiId },
      relations: ['prot'],
    });

    if (!verifikasi) {
      this.logger.error(`Verifikasi ${verifikasiId} not found for blockchain anchoring`);
      return;
    }

    const prot = verifikasi.prot;
    const dataHash = this.computeHash(prot);

    // Determine next version (count existing confirmed/pending proofs for this prot)
    const existingCount = await this.proofRepository.count({
      where: { prot_id: prot.id },
    });
    const version = existingCount + 1;

    // Create pending proof row first
    const proof = this.proofRepository.create({
      verifikasi_id: verifikasiId,
      prot_id: prot.id,
      version,
      data_hash: dataHash,
      blockchain_network: this.configService.get<string>('BLOCKCHAIN_NETWORK') || 'polygon-mumbai',
      status: BlockchainProofStatus.PENDING,
    });
    await this.proofRepository.save(proof);

    await this.sendToChain(proof, prot.id, dataHash);
  }

  /**
   * Send transaction to chain and update proof row.
   * Called by anchorVerification and by the retry scheduler.
   */
  async sendToChain(
    proof: BlockchainProof,
    protId: string,
    dataHash: string,
  ): Promise<void> {
    if (!this.contract) {
      this.logger.warn('Blockchain contract not initialized. Skipping anchor.');
      return;
    }

    try {
      const hashBytes = '0x' + dataHash;
      const tx = await this.contract.recordVerification(protId, hashBytes);
      const receipt = await tx.wait();

      proof.tx_hash = receipt.hash;
      proof.block_number = Number(receipt.blockNumber);
      proof.status = BlockchainProofStatus.CONFIRMED;
      proof.anchored_at = new Date();
      proof.last_error = null;
      await this.proofRepository.save(proof);

      this.logger.log(
        `Anchored PROT ${protId} at block ${receipt.blockNumber}, tx: ${receipt.hash}`,
      );
    } catch (err) {
      proof.retry_count += 1;
      proof.last_error = err instanceof Error ? err.message : String(err);
      proof.status =
        proof.retry_count >= 3
          ? BlockchainProofStatus.FAILED
          : BlockchainProofStatus.PENDING;
      await this.proofRepository.save(proof);

      this.logger.error(
        `Blockchain anchor failed for PROT ${protId} (attempt ${proof.retry_count}): ${proof.last_error}`,
      );
    }
  }

  /**
   * Integrity check: re-computes hash and compares against on-chain record.
   */
  async checkIntegrity(protId: string): Promise<{
    dbIntact: boolean;
    chainIntact: boolean;
    fullyVerified: boolean;
    details: {
      storedHash: string | null;
      currentHash: string;
      onChainHash: string | null;
      status: string | null;
      txHash: string | null;
      blockNumber: number | null;
    };
  }> {
    const prot = await this.protRepository.findOne({ where: { id: protId } });
    if (!prot) {
      return {
        dbIntact: false,
        chainIntact: false,
        fullyVerified: false,
        details: { storedHash: null, currentHash: '', onChainHash: null, status: null, txHash: null, blockNumber: null },
      };
    }

    // Get latest confirmed proof for this prot
    const proof = await this.proofRepository.findOne({
      where: { prot_id: protId, status: BlockchainProofStatus.CONFIRMED },
      order: { version: 'DESC' },
    });

    const currentHash = this.computeHash(prot);
    const dbIntact = proof ? currentHash === proof.data_hash : false;

    let chainIntact = false;
    let onChainHash: string | null = null;

    if (proof && this.contract) {
      try {
        const record = await this.contract.getLatest(protId);
        onChainHash = record.dataHash.replace('0x', '');
        chainIntact = onChainHash === proof.data_hash;
      } catch {
        chainIntact = false;
      }
    }

    return {
      dbIntact,
      chainIntact,
      fullyVerified: dbIntact && chainIntact,
      details: {
        storedHash: proof?.data_hash ?? null,
        currentHash,
        onChainHash,
        status: proof?.status ?? null,
        txHash: proof?.tx_hash ?? null,
        blockNumber: proof?.block_number ?? null,
      },
    };
  }

  /**
   * Called by scheduler to retry pending/failed proofs.
   */
  async retryPendingProofs(): Promise<void> {
    const pendingProofs = await this.proofRepository
      .createQueryBuilder('bp')
      .where('bp.status = :status', { status: BlockchainProofStatus.PENDING })
      .andWhere('bp.retry_count < :max', { max: 3 })
      .getMany();

    for (const proof of pendingProofs) {
      this.logger.log(`Retrying blockchain proof ${proof.id} (attempt ${proof.retry_count + 1})`);
      await this.sendToChain(proof, proof.prot_id, proof.data_hash);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/modules/blockchain/blockchain.service.ts
git commit -m "feat(blockchain): add BlockchainService with hash, anchor, and integrity check"
```

---

## Task 9: BlockchainScheduler

**Files:**
- Create: `src/modules/blockchain/blockchain.scheduler.ts`

**Step 1: Write the scheduler**

`src/modules/blockchain/blockchain.scheduler.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlockchainService } from './blockchain.service';

@Injectable()
export class BlockchainScheduler {
  private readonly logger = new Logger(BlockchainScheduler.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPendingProofs() {
    this.logger.log('Running blockchain proof retry job...');
    await this.blockchainService.retryPendingProofs();
  }
}
```

**Step 2: Commit**

```bash
git add src/modules/blockchain/blockchain.scheduler.ts
git commit -m "feat(blockchain): add retry scheduler for pending proofs"
```

---

## Task 10: BlockchainModule

**Files:**
- Create: `src/modules/blockchain/blockchain.module.ts`

**Step 1: Write the module**

`src/modules/blockchain/blockchain.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { BlockchainScheduler } from './blockchain.scheduler';
import { BlockchainProof } from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainProof, Verifikasi, PROT])],
  providers: [BlockchainService, BlockchainScheduler],
  exports: [BlockchainService],
})
export class BlockchainModule {}
```

**Step 2: Commit**

```bash
git add src/modules/blockchain/blockchain.module.ts
git commit -m "feat(blockchain): add BlockchainModule"
```

---

## Task 11: Wire BlockchainModule into ProtModule and AppModule

**Files:**
- Modify: `src/modules/prot/prot.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/modules/prot/verifikasi.service.ts`

**Step 1: Read current prot.module.ts**

Read `src/modules/prot/prot.module.ts` before editing.

**Step 2: Add BlockchainModule import to ProtModule**

In `src/modules/prot/prot.module.ts`, add to `imports` array:
```typescript
import { BlockchainModule } from '../blockchain/blockchain.module';
// ...
imports: [
  TypeOrmModule.forFeature([PROT, Verifikasi, VerifikasiQueue]),
  BlockchainModule,
],
```

**Step 3: Add BlockchainModule to AppModule**

In `src/app.module.ts`, add `BlockchainModule` to the `imports` array:
```typescript
import { BlockchainModule } from './modules/blockchain/blockchain.module';
// add BlockchainModule to the imports array
```

**Step 4: Inject BlockchainService into VerifikasiService**

In `src/modules/prot/verifikasi.service.ts`:

Add import:
```typescript
import { BlockchainService } from '../blockchain/blockchain.service';
```

Add to constructor:
```typescript
constructor(
  @InjectRepository(Verifikasi)
  private readonly verifikasiRepository: Repository<Verifikasi>,
  @InjectRepository(VerifikasiQueue)
  private readonly queueRepository: Repository<VerifikasiQueue>,
  @InjectRepository(PROT)
  private readonly protRepository: Repository<PROT>,
  private readonly blockchainService: BlockchainService,  // ADD THIS
) {}
```

**Step 5: Add fire-and-forget call in submitReview**

In `src/modules/prot/verifikasi.service.ts`, after `await this.protRepository.save(prot)` (line ~196), inside the `APPROVED` case:

```typescript
case VerifikasiStatus.APPROVED:
  prot.status = PROTStatus.DIVERIFIKASI;
  prot.verified_by = pakarId;
  prot.verified_at = new Date();
  break;
```

After the switch block, before `await this.queueRepository.remove(queue)`, add:

```typescript
// Fire-and-forget blockchain anchoring — does not block the response
if (reviewDto.status === VerifikasiStatus.APPROVED) {
  this.blockchainService.anchorVerification(verifikasi.id).catch((err: Error) => {
    // blockchain_proof row is already created with status: pending
    // the scheduler will retry automatically
    new Logger('VerifikasiService').error(
      `Blockchain anchor failed for verifikasi ${verifikasi.id}: ${err.message}`,
    );
  });
}
```

**Step 6: Commit**

```bash
git add src/modules/prot/prot.module.ts src/modules/prot/verifikasi.service.ts src/app.module.ts
git commit -m "feat(blockchain): wire BlockchainService into verification flow"
```

---

## Task 12: Add env vars to .env

**Files:**
- Modify: `.env` (and `.env.example` if it exists)

**Step 1: Add blockchain env vars to .env**

```
BLOCKCHAIN_RPC_URL=https://rpc-mumbai.maticvigil.com
BLOCKCHAIN_PRIVATE_KEY=0x_your_wallet_private_key
BLOCKCHAIN_CONTRACT_ADDRESS=0x_deployed_contract_address
BLOCKCHAIN_NETWORK=polygon-mumbai
```

Note: `BLOCKCHAIN_CONTRACT_ADDRESS` is obtained after running `npm run deploy:mumbai` from `backend/blockchain/`.

**Step 2: Verify ConfigModule loads these**

Check `src/config/app.config.ts` or `src/app.module.ts` that `ConfigModule.forRoot({ isGlobal: true })` is present — it is, so no changes needed.

**Step 3: Commit .env.example only (never commit .env)**

```bash
git add .env.example
git commit -m "feat(blockchain): add blockchain env vars to .env.example"
```

---

## Task 13: End-to-End Smoke Test

**Step 1: Start a local Hardhat node**

```bash
cd backend/blockchain && npx hardhat node
```

**Step 2: Deploy to local node**

In a second terminal:
```bash
cd backend/blockchain && npm run deploy:local
```

Copy the deployed address. Set in `.env`:
```
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CONTRACT_ADDRESS=<address from above>
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BLOCKCHAIN_NETWORK=localhost
```

(The private key above is Hardhat's default account #0 — safe for local testing only.)

**Step 3: Start the backend**

```bash
npm run start:dev
```

**Step 4: Trigger a verification approval via API**

Use the existing Postman collection or curl to:
1. Submit a PROT for review (status → DIKURASI)
2. Pick it from queue as a pakar
3. Submit review with `status: APPROVED`

**Step 5: Check blockchain_proof table**

```sql
SELECT * FROM blockchain_proof ORDER BY created_at DESC LIMIT 5;
```

Expected: one row with `status = confirmed`, `tx_hash` populated, `block_number` not null.

**Step 6: Commit**

No code changes — this is a verification step only.

---

## Task 14: Deploy to Polygon Mumbai

**Prerequisites:**
- Get Mumbai testnet MATIC from faucet: https://faucet.polygon.technology/
- Set real `PRIVATE_KEY` and `MUMBAI_RPC_URL` in `backend/blockchain/.env`

**Step 1: Deploy**

```bash
cd backend/blockchain && npm run deploy:mumbai
```

Expected output:
```
Deploying with account: 0x...
ProtVerification deployed to: 0x...
Set BLOCKCHAIN_CONTRACT_ADDRESS=0x... in your backend .env
```

**Step 2: Update backend .env**

```
BLOCKCHAIN_RPC_URL=https://rpc-mumbai.maticvigil.com
BLOCKCHAIN_CONTRACT_ADDRESS=0x<address from deploy>
BLOCKCHAIN_NETWORK=polygon-mumbai
```

**Step 3: Commit the deployed address to docs**

```bash
# Add to docs or README — never hardcode in source
echo "Contract deployed to Mumbai: 0x<address>" >> docs/blockchain.md
git add docs/blockchain.md
git commit -m "docs: record Mumbai contract deployment address"
```

---

## Summary of All Files Created/Modified

| Action | File |
|--------|------|
| Create | `backend/blockchain/package.json` |
| Create | `backend/blockchain/hardhat.config.ts` |
| Create | `backend/blockchain/tsconfig.json` |
| Create | `backend/blockchain/.env.example` |
| Create | `backend/blockchain/.gitignore` |
| Create | `backend/blockchain/contracts/ProtVerification.sol` |
| Create | `backend/blockchain/test/ProtVerification.test.ts` |
| Create | `backend/blockchain/scripts/deploy.ts` |
| Create | `src/migrations/1742000000000-AddBlockchainProof.ts` |
| Create | `src/modules/blockchain/abi/ProtVerification.json` |
| Create | `src/modules/blockchain/entities/blockchain-proof.entity.ts` |
| Create | `src/modules/blockchain/blockchain.service.ts` |
| Create | `src/modules/blockchain/blockchain.scheduler.ts` |
| Create | `src/modules/blockchain/blockchain.module.ts` |
| Modify | `src/modules/prot/prot.module.ts` |
| Modify | `src/modules/prot/verifikasi.service.ts` |
| Modify | `src/app.module.ts` |
| Modify | `.env` / `.env.example` |
