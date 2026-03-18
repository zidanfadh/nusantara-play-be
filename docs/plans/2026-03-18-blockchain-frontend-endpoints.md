# Blockchain Frontend Endpoints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose HTTP endpoints so the frontend can display a blockchain verification badge on each PROT detail page and allow admins to manually re-trigger failed anchoring.

**Architecture:** Two new public-facing routes are added to a new `BlockchainController` mounted at `/prot`. A new `getProofForProt()` service method returns proof metadata plus an inline integrity check (recomputes SHA-256 hash and optionally queries the chain). A `triggerReanchor()` method lets admins reset failed/pending proof rows and fire a new chain transaction. Both methods are added to the existing `BlockchainService`. The `BlockchainModule` is updated to register the controller.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest (unit tests), existing `JwtAuthGuard` + `RolesGuard` + `@Public()` + `@Roles()` patterns already in the codebase.

---

## Reference: Existing Code

| Item | Location |
|------|----------|
| `BlockchainService` | `src/modules/blockchain/blockchain.service.ts` |
| `BlockchainModule` | `src/modules/blockchain/blockchain.module.ts` |
| `BlockchainProof` entity | `src/modules/blockchain/entities/blockchain-proof.entity.ts` |
| `BlockchainProofStatus` enum | `src/modules/blockchain/entities/blockchain-proof.entity.ts:14-18` |
| `JwtAuthGuard` | `src/common/guards/jwt-auth.guard.ts` |
| `@Public()` decorator | `src/common/decorators/public.decorator.ts` |
| `@Roles()` decorator | `src/common/decorators/roles.decorator.ts` |
| `UserRole` enum | `src/modules/users/entities/user.entity.ts` |
| `VerifikasiStatus` enum | `src/modules/prot/entities/verifikasi.entity.ts:13-18` |
| Existing service spec pattern | `src/modules/prot/verifikasi.service.spec.ts` |

**Auth pattern used across codebase:**
```typescript
@Controller('prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  @Get(':id')
  @Public()                         // ← publicly accessible, no JWT required
  async findOne() { ... }

  @Post(':id/action')
  @Roles(UserRole.ADMIN_KPOTI)      // ← only ADMIN_KPOTI role
  async adminAction() { ... }
}
```

**`block_number` field type:** It is stored as `string | null` in both the entity and the `checkIntegrity()` return type (TypeORM bigint columns come back as strings from PostgreSQL).

---

## Endpoints to Build

```
GET  /prot/:id/blockchain-proof           → Public
POST /prot/:id/blockchain-proof/reanchor  → Admin only (ADMIN_KPOTI)
```

### `GET /prot/:id/blockchain-proof` — Response shape

**When proof exists:**
```json
{
  "protId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "confirmed",
  "version": 1,
  "txHash": "0xabc123...",
  "blockNumber": "12345678",
  "network": "polygon-amoy",
  "anchoredAt": "2026-03-17T10:00:05.000Z",
  "integrity": {
    "dbIntact": true,
    "chainIntact": true,
    "fullyVerified": true
  }
}
```

**When PROT is pending/failed anchoring:**
```json
{
  "protId": "...",
  "status": "pending",
  "version": 1,
  "txHash": null,
  "blockNumber": null,
  "network": "polygon-amoy",
  "anchoredAt": null,
  "integrity": {
    "dbIntact": false,
    "chainIntact": false,
    "fullyVerified": false
  }
}
```

**When no proof exists at all:** `404 Not Found`

### `POST /prot/:id/blockchain-proof/reanchor` — Response shape

```json
{
  "message": "Reanchor initiated",
  "proofId": "uuid-of-the-proof-row"
}
```

Errors:
- `404` — no blockchain proof record exists for this PROT
- `409 Conflict` — proof is already `confirmed`, no reanchor needed

---

## Task 1: Create Response DTO

**Files:**
- Create: `src/modules/blockchain/dto/blockchain-proof-response.dto.ts`

**Step 1: Create the DTO file**

`src/modules/blockchain/dto/blockchain-proof-response.dto.ts`:

```typescript
import { BlockchainProofStatus } from '../entities/blockchain-proof.entity';

export class BlockchainProofResponseDto {
  protId: string;
  status: BlockchainProofStatus | null;
  version: number | null;
  txHash: string | null;
  blockNumber: string | null;
  network: string | null;
  anchoredAt: Date | null;
  integrity: {
    dbIntact: boolean;
    chainIntact: boolean;
    fullyVerified: boolean;
  };
}
```

**Step 2: Commit**

```bash
git add src/modules/blockchain/dto/
git commit -m "feat(blockchain): add BlockchainProofResponseDto"
```

---

## Task 2: TDD — `getProofForProt()` service method

**Files:**
- Create: `src/modules/blockchain/blockchain.service.spec.ts`
- Modify: `src/modules/blockchain/blockchain.service.ts`

### Step 1: Write the failing tests

Create `src/modules/blockchain/blockchain.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BlockchainProof, BlockchainProofStatus } from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';

const mockProofRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockVerifikasiRepository = {
  findOne: jest.fn(),
};

const mockProtRepository = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: getRepositoryToken(BlockchainProof), useValue: mockProofRepository },
        { provide: getRepositoryToken(Verifikasi), useValue: mockVerifikasiRepository },
        { provide: getRepositoryToken(PROT), useValue: mockProtRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProofForProt', () => {
    it('returns null when no proof exists', async () => {
      mockProofRepository.findOne.mockResolvedValue(null);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).toBeNull();
      expect(mockProofRepository.findOne).toHaveBeenCalledWith({
        where: { prot_id: 'prot-uuid-1' },
        order: { version: 'DESC' },
      });
    });

    it('returns proof data without integrity check when status is PENDING', async () => {
      const proof = {
        id: 'proof-1',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 1,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'polygon-amoy',
        anchored_at: null,
        data_hash: 'abc123',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe(BlockchainProofStatus.PENDING);
      expect(result!.txHash).toBeNull();
      expect(result!.integrity.dbIntact).toBe(false);
      expect(result!.integrity.chainIntact).toBe(false);
      expect(result!.integrity.fullyVerified).toBe(false);
      // Should NOT query PROT for hash recomputation when status is PENDING
      expect(mockProtRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns proof data without integrity check when status is FAILED', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.FAILED,
        version: 1,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'polygon-amoy',
        anchored_at: null,
        data_hash: 'abc123',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.status).toBe(BlockchainProofStatus.FAILED);
      expect(result!.integrity.fullyVerified).toBe(false);
      expect(mockProtRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns proof data with dbIntact=true when hash matches for CONFIRMED proof', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        tx_hash: '0xabc',
        block_number: '12345',
        blockchain_network: 'polygon-amoy',
        anchored_at: new Date('2026-03-17T10:00:05.000Z'),
        data_hash: 'will-be-replaced-by-computed-hash',
      } as BlockchainProof;

      const prot = { id: 'prot-uuid-1', nama: 'Gobak Sodor' } as PROT;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProtRepository.findOne.mockResolvedValue(prot);

      // Compute the real hash so we can set it on the proof
      // We'll spy on computeHash to control the test
      jest.spyOn(service, 'computeHash').mockReturnValue('fixed-hash-abc');
      proof.data_hash = 'fixed-hash-abc'; // matches computed hash → dbIntact = true

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.status).toBe(BlockchainProofStatus.CONFIRMED);
      expect(result!.integrity.dbIntact).toBe(true);
      expect(result!.txHash).toBe('0xabc');
      expect(result!.blockNumber).toBe('12345');
    });

    it('returns dbIntact=false when computed hash does not match stored hash', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        tx_hash: '0xabc',
        block_number: '12345',
        blockchain_network: 'polygon-amoy',
        anchored_at: new Date(),
        data_hash: 'original-hash',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProtRepository.findOne.mockResolvedValue({ id: 'prot-uuid-1' } as PROT);
      jest.spyOn(service, 'computeHash').mockReturnValue('tampered-hash');
      // proof.data_hash = 'original-hash' !== 'tampered-hash' → dbIntact = false

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result!.integrity.dbIntact).toBe(false);
      expect(result!.integrity.fullyVerified).toBe(false);
    });

    it('maps all proof fields to response correctly', async () => {
      const anchoredAt = new Date('2026-03-17T10:00:05.000Z');
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 2,
        tx_hash: null,
        block_number: null,
        blockchain_network: 'localhost',
        anchored_at: null,
        data_hash: 'hash-abc',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      const result = await service.getProofForProt('prot-uuid-1');

      expect(result).toMatchObject({
        protId: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        version: 2,
        txHash: null,
        blockNumber: null,
        network: 'localhost',
        anchoredAt: null,
      });
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx jest src/modules/blockchain/blockchain.service.spec.ts --no-coverage
```

Expected: FAIL with `TypeError: service.getProofForProt is not a function`

### Step 3: Add `getProofForProt()` to BlockchainService

In `src/modules/blockchain/blockchain.service.ts`, add the import for the DTO and add the method at the end of the class, before the closing `}`:

First add the import at the top of the file (after existing imports):

```typescript
import { BlockchainProofResponseDto } from './dto/blockchain-proof-response.dto';
```

Then add the method inside the `BlockchainService` class:

```typescript
/**
 * Returns the latest blockchain proof for a PROT with integrity check.
 * Returns null if no proof exists.
 * Integrity check (hash recomputation + chain query) is only performed for CONFIRMED proofs.
 */
async getProofForProt(protId: string): Promise<BlockchainProofResponseDto | null> {
  const proof = await this.proofRepository.findOne({
    where: { prot_id: protId },
    order: { version: 'DESC' },
  });

  if (!proof) return null;

  const response: BlockchainProofResponseDto = {
    protId,
    status: proof.status,
    version: proof.version,
    txHash: proof.tx_hash,
    blockNumber: proof.block_number,
    network: proof.blockchain_network,
    anchoredAt: proof.anchored_at,
    integrity: {
      dbIntact: false,
      chainIntact: false,
      fullyVerified: false,
    },
  };

  if (proof.status === BlockchainProofStatus.CONFIRMED) {
    const prot = await this.protRepository.findOne({ where: { id: protId } });
    if (prot) {
      const currentHash = this.computeHash(prot);
      const dbIntact = currentHash === proof.data_hash;

      let chainIntact = false;
      if (this.contract) {
        try {
          const record = await this.contract['getLatest'](protId);
          const onChainHash = (record.dataHash as string).replace('0x', '');
          chainIntact = onChainHash === currentHash;
        } catch (err) {
          this.logger.warn(
            `Chain query failed for PROT ${protId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      response.integrity = { dbIntact, chainIntact, fullyVerified: dbIntact && chainIntact };
    }
  }

  return response;
}
```

### Step 4: Run tests to verify they pass

```bash
npx jest src/modules/blockchain/blockchain.service.spec.ts --no-coverage
```

Expected: all tests PASS (5 passing, any skipped for chain tests without contract mock)

### Step 5: Commit

```bash
git add src/modules/blockchain/blockchain.service.ts \
        src/modules/blockchain/blockchain.service.spec.ts \
        src/modules/blockchain/dto/
git commit -m "feat(blockchain): add getProofForProt() with TDD"
```

---

## Task 3: TDD — `triggerReanchor()` service method

**Files:**
- Modify: `src/modules/blockchain/blockchain.service.spec.ts`
- Modify: `src/modules/blockchain/blockchain.service.ts`

### Step 1: Add failing tests to the spec file

Open `src/modules/blockchain/blockchain.service.spec.ts` and add a new `describe` block after the `getProofForProt` describe block (before the closing `describe('BlockchainService'` brace):

```typescript
  describe('triggerReanchor', () => {
    it('throws NotFoundException when no proof exists for the PROT', async () => {
      mockProofRepository.findOne.mockResolvedValue(null);

      await expect(service.triggerReanchor('prot-uuid-1')).rejects.toThrow(
        'No blockchain proof record found for PROT prot-uuid-1',
      );
    });

    it('throws ConflictException when proof is already CONFIRMED', async () => {
      const proof = {
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);

      await expect(service.triggerReanchor('prot-uuid-1')).rejects.toThrow(
        'Blockchain proof is already confirmed',
      );
    });

    it('resets retry_count and status, then calls sendToChain for FAILED proof', async () => {
      const proof = {
        id: 'proof-1',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.FAILED,
        retry_count: 3,
        data_hash: 'hash-abc',
        last_error: 'some error',
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProofRepository.save.mockResolvedValue(proof);

      const sendToChainSpy = jest
        .spyOn(service, 'sendToChain')
        .mockResolvedValue(undefined);

      const result = await service.triggerReanchor('prot-uuid-1');

      expect(mockProofRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 0,
          status: BlockchainProofStatus.PENDING,
          last_error: null,
        }),
      );
      expect(sendToChainSpy).toHaveBeenCalledWith(proof, 'prot-uuid-1', 'hash-abc');
      expect(result).toMatchObject({ message: 'Reanchor initiated', proofId: 'proof-1' });
    });

    it('resets retry_count and calls sendToChain for PENDING proof with maxed retries', async () => {
      const proof = {
        id: 'proof-2',
        prot_id: 'prot-uuid-1',
        status: BlockchainProofStatus.PENDING,
        retry_count: 3,
        data_hash: 'hash-xyz',
        last_error: null,
      } as BlockchainProof;

      mockProofRepository.findOne.mockResolvedValue(proof);
      mockProofRepository.save.mockResolvedValue(proof);

      jest.spyOn(service, 'sendToChain').mockResolvedValue(undefined);

      await service.triggerReanchor('prot-uuid-1');

      expect(mockProofRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ retry_count: 0, status: BlockchainProofStatus.PENDING }),
      );
    });
  });
```

Also add the required imports at the top of the spec file:

```typescript
import { NotFoundException, ConflictException } from '@nestjs/common';
```

### Step 2: Run tests to verify they fail

```bash
npx jest src/modules/blockchain/blockchain.service.spec.ts --no-coverage -t "triggerReanchor"
```

Expected: FAIL with `TypeError: service.triggerReanchor is not a function`

### Step 3: Add `triggerReanchor()` to BlockchainService

Add these imports at the top of `src/modules/blockchain/blockchain.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
```

(Replace the existing `Injectable, Logger, OnModuleInit` import line.)

Then add the method inside the `BlockchainService` class, after `getProofForProt`:

```typescript
/**
 * Admin: reset a failed/pending proof and re-trigger chain anchoring.
 * Throws NotFoundException if no proof row exists for this PROT.
 * Throws ConflictException if the proof is already CONFIRMED.
 */
async triggerReanchor(protId: string): Promise<{ message: string; proofId: string }> {
  const proof = await this.proofRepository.findOne({
    where: { prot_id: protId },
    order: { version: 'DESC' },
  });

  if (!proof) {
    throw new NotFoundException(`No blockchain proof record found for PROT ${protId}`);
  }

  if (proof.status === BlockchainProofStatus.CONFIRMED) {
    throw new ConflictException('Blockchain proof is already confirmed');
  }

  proof.retry_count = 0;
  proof.status = BlockchainProofStatus.PENDING;
  proof.last_error = null;
  await this.proofRepository.save(proof);

  // Fire-and-forget — sendToChain will update the proof row on completion
  this.sendToChain(proof, protId, proof.data_hash).catch((err: Error) => {
    this.logger.error(`Manual reanchor failed for PROT ${protId}: ${err.message}`);
  });

  return { message: 'Reanchor initiated', proofId: proof.id };
}
```

### Step 4: Run all service tests to verify they pass

```bash
npx jest src/modules/blockchain/blockchain.service.spec.ts --no-coverage
```

Expected: all tests PASS

### Step 5: Commit

```bash
git add src/modules/blockchain/blockchain.service.ts \
        src/modules/blockchain/blockchain.service.spec.ts
git commit -m "feat(blockchain): add triggerReanchor() with TDD"
```

---

## Task 4: TDD — BlockchainController

**Files:**
- Create: `src/modules/blockchain/blockchain.controller.spec.ts`
- Create: `src/modules/blockchain/blockchain.controller.ts`

### Step 1: Write the failing controller tests

Create `src/modules/blockchain/blockchain.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { BlockchainProofStatus } from './entities/blockchain-proof.entity';

const mockBlockchainService = {
  getProofForProt: jest.fn(),
  triggerReanchor: jest.fn(),
};

describe('BlockchainController', () => {
  let controller: BlockchainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        { provide: BlockchainService, useValue: mockBlockchainService },
      ],
    }).compile();

    controller = module.get<BlockchainController>(BlockchainController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET :id/blockchain-proof', () => {
    it('returns proof data when proof exists', async () => {
      const proofData = {
        protId: 'prot-uuid-1',
        status: BlockchainProofStatus.CONFIRMED,
        version: 1,
        txHash: '0xabc',
        blockNumber: '12345',
        network: 'polygon-amoy',
        anchoredAt: new Date(),
        integrity: { dbIntact: true, chainIntact: true, fullyVerified: true },
      };
      mockBlockchainService.getProofForProt.mockResolvedValue(proofData);

      const result = await controller.getBlockchainProof('prot-uuid-1');

      expect(result).toEqual(proofData);
      expect(mockBlockchainService.getProofForProt).toHaveBeenCalledWith('prot-uuid-1');
    });

    it('throws NotFoundException when service returns null', async () => {
      mockBlockchainService.getProofForProt.mockResolvedValue(null);

      await expect(controller.getBlockchainProof('prot-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST :id/blockchain-proof/reanchor', () => {
    it('returns reanchor result on success', async () => {
      const reanchorResult = { message: 'Reanchor initiated', proofId: 'proof-1' };
      mockBlockchainService.triggerReanchor.mockResolvedValue(reanchorResult);

      const result = await controller.reanchorProof('prot-uuid-1');

      expect(result).toEqual(reanchorResult);
      expect(mockBlockchainService.triggerReanchor).toHaveBeenCalledWith('prot-uuid-1');
    });

    it('propagates NotFoundException from service', async () => {
      mockBlockchainService.triggerReanchor.mockRejectedValue(
        new NotFoundException('No blockchain proof record found for PROT prot-uuid-1'),
      );

      await expect(controller.reanchorProof('prot-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException from service', async () => {
      mockBlockchainService.triggerReanchor.mockRejectedValue(
        new ConflictException('Blockchain proof is already confirmed'),
      );

      await expect(controller.reanchorProof('prot-uuid-1')).rejects.toThrow(ConflictException);
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx jest src/modules/blockchain/blockchain.controller.spec.ts --no-coverage
```

Expected: FAIL with `Cannot find module './blockchain.controller'`

### Step 3: Create BlockchainController

Create `src/modules/blockchain/blockchain.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get(':id/blockchain-proof')
  @Public()
  async getBlockchainProof(@Param('id') protId: string) {
    const result = await this.blockchainService.getProofForProt(protId);
    if (!result) {
      throw new NotFoundException(`No blockchain proof found for PROT ${protId}`);
    }
    return result;
  }

  @Post(':id/blockchain-proof/reanchor')
  @Roles(UserRole.ADMIN_KPOTI)
  async reanchorProof(@Param('id') protId: string) {
    return this.blockchainService.triggerReanchor(protId);
  }
}
```

### Step 4: Run controller tests to verify they pass

```bash
npx jest src/modules/blockchain/blockchain.controller.spec.ts --no-coverage
```

Expected: all tests PASS

### Step 5: Commit

```bash
git add src/modules/blockchain/blockchain.controller.ts \
        src/modules/blockchain/blockchain.controller.spec.ts
git commit -m "feat(blockchain): add BlockchainController with TDD"
```

---

## Task 5: Register Controller in BlockchainModule

**Files:**
- Modify: `src/modules/blockchain/blockchain.module.ts`

### Step 1: Read the current module

Read `src/modules/blockchain/blockchain.module.ts` to see current state before editing.

### Step 2: Update the module

Replace the contents of `src/modules/blockchain/blockchain.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { BlockchainScheduler } from './blockchain.scheduler';
import { BlockchainController } from './blockchain.controller';
import { BlockchainProof } from './entities/blockchain-proof.entity';
import { Verifikasi } from '../prot/entities/verifikasi.entity';
import { PROT } from '../prot/entities/prot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainProof, Verifikasi, PROT])],
  controllers: [BlockchainController],
  providers: [BlockchainService, BlockchainScheduler],
  exports: [BlockchainService],
})
export class BlockchainModule {}
```

### Step 3: Run the full test suite to check for regressions

```bash
npx jest --no-coverage
```

Expected: all existing tests still pass, new tests also pass. If there are any failures, read the error message carefully — do not blindly re-run.

### Step 4: Commit

```bash
git add src/modules/blockchain/blockchain.module.ts
git commit -m "feat(blockchain): register BlockchainController in BlockchainModule"
```

---

## Task 6: Manual Smoke Test

This is a verification step — no code changes.

### Step 1: Start the app

```bash
npm run start:dev
```

Watch for any startup errors. The log should show:
```
[BlockchainService] BlockchainService initialized. Contract: 0x...
```
or the warning:
```
[BlockchainService] Blockchain env vars not configured. BlockchainService will be inactive.
```
Either is acceptable — the endpoints still work; they just won't make chain calls in the second case.

### Step 2: Test `GET /prot/:id/blockchain-proof`

Use curl or Postman. Replace `{prot_id}` with a UUID of a PROT that has a `blockchain_proof` row:

```bash
curl http://localhost:3000/prot/{prot_id}/blockchain-proof
```

Expected (if PROT has a confirmed proof):
```json
{
  "protId": "...",
  "status": "confirmed",
  "version": 1,
  "txHash": "0x...",
  "blockNumber": "12345678",
  "network": "polygon-amoy",
  "anchoredAt": "...",
  "integrity": { "dbIntact": true, "chainIntact": true, "fullyVerified": true }
}
```

Expected (no proof for this PROT):
```json
{ "statusCode": 404, "message": "No blockchain proof found for PROT ...", "error": "Not Found" }
```

### Step 3: Test `POST /prot/:id/blockchain-proof/reanchor` (requires admin JWT)

```bash
curl -X POST http://localhost:3000/prot/{prot_id}/blockchain-proof/reanchor \
  -H "Authorization: Bearer {admin_jwt_token}"
```

Expected for a FAILED proof:
```json
{ "message": "Reanchor initiated", "proofId": "..." }
```

Expected for a CONFIRMED proof:
```json
{ "statusCode": 409, "message": "Blockchain proof is already confirmed", "error": "Conflict" }
```

### Step 4: Final commit (docs update only)

```bash
# Update next-steps.md Step 4 status to completed
git add docs/blockchain-next-steps.md
git commit -m "docs(blockchain): mark Step 4 (HTTP endpoints) as complete"
```

---

## Summary of All Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/modules/blockchain/dto/blockchain-proof-response.dto.ts` |
| Create | `src/modules/blockchain/blockchain.service.spec.ts` |
| Create | `src/modules/blockchain/blockchain.controller.ts` |
| Create | `src/modules/blockchain/blockchain.controller.spec.ts` |
| Modify | `src/modules/blockchain/blockchain.service.ts` (add 2 methods) |
| Modify | `src/modules/blockchain/blockchain.module.ts` (add controller) |

**No database migrations needed** — the `blockchain_proof` table already exists.

**No changes to existing routes** — `BlockchainController` is mounted at `@Controller('prot')` but its sub-paths (`:id/blockchain-proof`, `:id/blockchain-proof/reanchor`) don't conflict with any existing route in `PROTController`.
