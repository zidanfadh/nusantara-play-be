# PROT Verification System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Menambahkan sistem verifikasi workflow 4 tahap pada modul PROT yang sudah ada, dengan ownership tracking, daerah scoping untuk kurator, verifikasi queue system untuk pakar, dan approval workflow.

**Context:** PROT module sudah ada dengan CRUD basic. Sekarang perlu menambahkan status workflow (Draft → Dikurasi → Diverifikasi → Arsip Nasional), role-based access control berdasarkan daerah, dan sistem verifikasi oleh pakar dengan mekanisme self-pick queue.

**Architecture:** Menambahkan status field & ownership tracking pada PROT entity, membuat entity Verifikasi untuk audit trail review pakar, entity VerifikasiQueue untuk antrian self-pick, VerifikasiService untuk business logic workflow, VerifikasiController untuk endpoint pakar dan admin, serta modifikasi PROT service untuk scoping berdasarkan daerah dan status.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (enum, FK, jsonb), RBAC (guards & decorators), AuditInterceptor

---

## Status Flow Design

```
[DRAFT] ──submit──▶ [DIKURASI] ──pick & review──┐
  ▲                                              │
  │                          ┌───────────────────┤
  │                          ▼                   ▼
  │                     [REJECTED]      [REVISION_NEEDED]
  │                     (→ DRAFT)              │
  │                                            ▼
  │                                        [REVISI]
  │                                            │
  │                                       re-submit
  │                                            │
  │                                            ▼
  │                                        [DIKURASI]
  │
  │      APPROVED
  │         │
  │         ▼
  │  [DIVERIFIKASI] ──publish──▶ [ARSIP_NASIONAL]
  │
  └──── (rejected kembali ke draft)
```

**Status meanings:**

- `DRAFT`: Kurator sedang mengerjakan
- `DIKURASI`: Sudah di-submit kurator, masuk antrian verifikasi
- `REVISI`: Pakar minta perbaikan, kurator sedang revisi
- `DIVERIFIKASI`: Sudah di-approve pakar, menunggu publish admin
- `ARSIP_NASIONAL`: Sudah dipublish admin, tampil ke publik
- `REJECTED`: Ditolak pakar, kembali ke DRAFT

---

## Task 1: Update PROT Entity (Status & Ownership)

**Files:**

- Edit: `src/modules/prot/entities/prot.entity.ts`

**Step 1: Tambah enum PROTStatus**

Tambahkan sebelum class PROT:

```typescript
export enum PROTStatus {
  DRAFT = 'DRAFT',
  DIKURASI = 'DIKURASI',
  REVISI = 'REVISI',
  DIVERIFIKASI = 'DIVERIFIKASI',
  ARSIP_NASIONAL = 'ARSIP_NASIONAL',
}
```

**Step 2: Tambah kolom status dan ownership tracking**

Tambahkan kolom-kolom ini di dalam class PROT (setelah kolom existing):

```typescript
  @Column({
    type: 'enum',
    enum: PROTStatus,
    default: PROTStatus.DRAFT,
  })
  status: PROTStatus;

  @Column({ type: 'uuid', name: 'created_by' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true, name: 'verified_by' })
  verified_by: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'published_by' })
  published_by: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'submitted_at' })
  submitted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verified_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'published_at' })
  published_at: Date | null;
```

**Step 3: Tambah relasi ke User entity**

```typescript
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedBy: User | null;
```

**Step 4: Import dependencies**

Pastikan import statement lengkap:

```typescript
import { User } from '../../users/entities/user.entity';
import { ManyToOne, JoinColumn } from 'typeorm';
```

**Expected result:** PROT entity sekarang punya status workflow dan tracking siapa yang create, verify, dan publish.

---

## Task 2: Create Verifikasi Entity

**Files:**

- Create: `src/modules/prot/entities/verifikasi.entity.ts`

**Step 1: Create entity file**

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
import { PROT } from './prot.entity';
import { User } from '../../users/entities/user.entity';

export enum VerifikasiStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_NEEDED = 'REVISION_NEEDED',
}

@Entity('verifikasi')
export class Verifikasi {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'prot_id' })
  prot_id: string;

  @Column({ type: 'uuid', name: 'pakar_id' })
  pakar_id: string;

  @Column({
    type: 'enum',
    enum: VerifikasiStatus,
    default: VerifikasiStatus.PENDING,
  })
  status: VerifikasiStatus;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({ type: 'text', nullable: true, name: 'saran_perbaikan' })
  saran_perbaikan: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'dokumen_pendukung',
    transformer: {
      to: (value: string[] | null) => (value ? JSON.stringify(value) : null),
      from: (value: string | null) => (value ? JSON.parse(value) : null),
    },
  })
  dokumen_pendukung: string[] | null;

  @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
  verified_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'pakar_id' })
  pakar: User;
}
```

**Expected result:** Entity Verifikasi untuk mencatat semua review yang dilakukan pakar pada sebuah PROT (audit trail).

---

## Task 3: Create VerifikasiQueue Entity

**Files:**

- Create: `src/modules/prot/entities/verifikasi-queue.entity.ts`

**Step 1: Create entity file**

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
import { PROT } from './prot.entity';
import { User } from '../../users/entities/user.entity';

@Entity('verifikasi_queue')
export class VerifikasiQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'prot_id', unique: true })
  prot_id: string;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_pakar_id' })
  assigned_pakar_id: string | null;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'timestamp', nullable: true, name: 'assigned_at' })
  assigned_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => PROT, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_pakar_id' })
  assignedPakar: User | null;
}
```

**Expected result:** Entity VerifikasiQueue untuk antrian PROT yang menunggu di-pick oleh pakar.

---

## Task 4: Export Entities from Index

**Files:**

- Edit: `src/modules/prot/entities/index.ts` (create if not exists)

**Step 1: Create barrel export**

```typescript
export * from './prot.entity';
export * from './verifikasi.entity';
export * from './verifikasi-queue.entity';
```

**Expected result:** Cleaner imports dari luar module.

---

## Task 5: Create TypeORM Migration

**Files:**

- Create: `src/migrations/1738827000000-AddPROTVerifikasi.ts`

**Step 1: Create migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPROTVerifikasi1738827000000 implements MigrationInterface {
  name = 'AddPROTVerifikasi1738827000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create prot_status enum
    await queryRunner.query(`
      CREATE TYPE prot_status AS ENUM (
        'DRAFT',
        'DIKURASI',
        'REVISI',
        'DIVERIFIKASI',
        'ARSIP_NASIONAL'
      )
    `);

    // 2. Add status and ownership columns to prot table
    await queryRunner.query(`
      ALTER TABLE prot
        ADD COLUMN status prot_status NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN created_by uuid NOT NULL,
        ADD COLUMN verified_by uuid,
        ADD COLUMN published_by uuid,
        ADD COLUMN submitted_at timestamp,
        ADD COLUMN verified_at timestamp,
        ADD COLUMN published_at timestamp
    `);

    // 3. Add foreign keys to users table
    await queryRunner.query(`
      ALTER TABLE prot
        ADD CONSTRAINT fk_prot_created_by 
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_prot_verified_by 
          FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_prot_published_by 
          FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
    `);

    // 4. Add indexes on prot table
    await queryRunner.query(`
      CREATE INDEX idx_prot_status ON prot(status);
      CREATE INDEX idx_prot_created_by ON prot(created_by);
      CREATE INDEX idx_prot_verified_by ON prot(verified_by);
    `);

    // 5. Create verifikasi_status enum
    await queryRunner.query(`
      CREATE TYPE verifikasi_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'REVISION_NEEDED'
      )
    `);

    // 6. Create verifikasi table
    await queryRunner.query(`
      CREATE TABLE verifikasi (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prot_id uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        pakar_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status verifikasi_status NOT NULL DEFAULT 'PENDING',
        catatan text,
        saran_perbaikan text,
        dokumen_pendukung jsonb,
        verified_at timestamp,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Add indexes on verifikasi table
    await queryRunner.query(`
      CREATE INDEX idx_verifikasi_prot_id ON verifikasi(prot_id);
      CREATE INDEX idx_verifikasi_pakar_id ON verifikasi(pakar_id);
      CREATE INDEX idx_verifikasi_status ON verifikasi(status);
      CREATE INDEX idx_verifikasi_created_at ON verifikasi(created_at DESC);
    `);

    // 8. Create verifikasi_queue table
    await queryRunner.query(`
      CREATE TABLE verifikasi_queue (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prot_id uuid NOT NULL UNIQUE REFERENCES prot(id) ON DELETE CASCADE,
        assigned_pakar_id uuid REFERENCES users(id) ON DELETE SET NULL,
        priority integer NOT NULL DEFAULT 0,
        assigned_at timestamp,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Add indexes on verifikasi_queue table
    await queryRunner.query(`
      CREATE INDEX idx_verifikasi_queue_prot_id ON verifikasi_queue(prot_id);
      CREATE INDEX idx_verifikasi_queue_assigned_pakar ON verifikasi_queue(assigned_pakar_id);
      CREATE INDEX idx_verifikasi_queue_priority ON verifikasi_queue(priority DESC, created_at ASC);
    `);

    // 10. Set default created_by for existing PROT records (use first admin or create placeholder)
    await queryRunner.query(`
      DO $$
      DECLARE
        admin_id uuid;
      BEGIN
        -- Get first admin_kpoti user
        SELECT id INTO admin_id FROM users WHERE role = 'admin_kpoti' LIMIT 1;
        
        -- If no admin exists, use first user
        IF admin_id IS NULL THEN
          SELECT id INTO admin_id FROM users LIMIT 1;
        END IF;
        
        -- Update existing PROT records
        IF admin_id IS NOT NULL THEN
          UPDATE prot SET created_by = admin_id WHERE created_by IS NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables and enums in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS verifikasi_queue CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS verifikasi CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS verifikasi_status`);

    await queryRunner.query(`
      ALTER TABLE prot
        DROP CONSTRAINT IF EXISTS fk_prot_created_by,
        DROP CONSTRAINT IF EXISTS fk_prot_verified_by,
        DROP CONSTRAINT IF EXISTS fk_prot_published_by,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS created_by,
        DROP COLUMN IF EXISTS verified_by,
        DROP COLUMN IF EXISTS published_by,
        DROP COLUMN IF EXISTS submitted_at,
        DROP COLUMN IF EXISTS verified_at,
        DROP COLUMN IF EXISTS published_at
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS prot_status`);
  }
}
```

**Expected result:** Migration yang bisa di-rollback, dengan default handling untuk data existing.

---

## Task 6: Create DTOs for Verification Workflow

**Files:**

- Create: `src/modules/prot/dto/submit-kurasi.dto.ts`
- Create: `src/modules/prot/dto/verifikasi-review.dto.ts`
- Create: `src/modules/prot/dto/publish-prot.dto.ts`

**Step 1: Create submit-kurasi.dto.ts**

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitKurasiDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan?: string; // Catatan optional dari kurator saat submit
}
```

**Step 2: Create verifikasi-review.dto.ts**

```typescript
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { VerifikasiStatus } from '../entities/verifikasi.entity';

export class VerifikasiReviewDto {
  @IsNotEmpty()
  @IsEnum(VerifikasiStatus)
  status: VerifikasiStatus;

  @IsOptional()
  @IsString()
  catatan?: string;

  @ValidateIf((o) => o.status === VerifikasiStatus.REVISION_NEEDED)
  @IsNotEmpty({
    message: 'Saran perbaikan wajib diisi jika status REVISION_NEEDED',
  })
  @IsString()
  saran_perbaikan?: string;

  @IsOptional()
  @IsString({ each: true })
  dokumen_pendukung?: string[]; // Array of URLs
}
```

**Step 3: Create publish-prot.dto.ts**

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishProtDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan?: string; // Catatan optional dari admin saat publish
}
```

**Step 4: Update query-prot.dto.ts**

Add status filter:

```typescript
import { IsOptional, IsEnum } from 'class-validator';
import { PROTStatus } from '../entities/prot.entity';

// ... existing imports and class

export class QueryProtDto {
  // ... existing fields

  @IsOptional()
  @IsEnum(PROTStatus)
  status?: PROTStatus;

  @IsOptional()
  @IsString()
  created_by?: string; // UUID filter
}
```

**Expected result:** DTOs untuk workflow submission, review, dan publish dengan validasi yang tepat.

---

## Task 7: Create VerifikasiService

**Files:**

- Create: `src/modules/prot/verifikasi.service.ts`

**Step 1: Create service file**

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Verifikasi, VerifikasiStatus } from './entities/verifikasi.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { PROT, PROTStatus } from './entities/prot.entity';
import { VerifikasiReviewDto } from './dto/verifikasi-review.dto';

@Injectable()
export class VerifikasiService {
  constructor(
    @InjectRepository(Verifikasi)
    private readonly verifikasiRepository: Repository<Verifikasi>,
    @InjectRepository(VerifikasiQueue)
    private readonly queueRepository: Repository<VerifikasiQueue>,
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
  ) {}

  /**
   * Get available queue (PROT yang belum di-assign ke pakar)
   */
  async getAvailableQueue(page = 1, limit = 20) {
    const [data, total] = await this.queueRepository.findAndCount({
      where: { assigned_pakar_id: IsNull() },
      relations: ['prot', 'prot.createdBy'],
      order: { priority: 'DESC', created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get queue items assigned to specific pakar
   */
  async getMyQueue(pakarId: string, page = 1, limit = 20) {
    const [data, total] = await this.queueRepository.findAndCount({
      where: { assigned_pakar_id: pakarId },
      relations: ['prot', 'prot.createdBy'],
      order: { assigned_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Pakar pick PROT from queue
   */
  async pickFromQueue(
    queueId: string,
    pakarId: string,
  ): Promise<VerifikasiQueue> {
    const queue = await this.queueRepository.findOne({
      where: { id: queueId },
      relations: ['prot'],
    });

    if (!queue) {
      throw new NotFoundException('Queue item tidak ditemukan');
    }

    if (queue.assigned_pakar_id) {
      throw new BadRequestException('PROT ini sudah di-claim oleh pakar lain');
    }

    // Check if PROT still in DIKURASI status
    if (queue.prot.status !== PROTStatus.DIKURASI) {
      throw new BadRequestException(
        `PROT dengan status ${queue.prot.status} tidak bisa di-pick`,
      );
    }

    queue.assigned_pakar_id = pakarId;
    queue.assigned_at = new Date();

    return this.queueRepository.save(queue);
  }

  /**
   * Pakar release PROT back to queue
   */
  async releaseFromQueue(
    queueId: string,
    pakarId: string,
  ): Promise<VerifikasiQueue> {
    const queue = await this.queueRepository.findOne({
      where: { id: queueId, assigned_pakar_id: pakarId },
    });

    if (!queue) {
      throw new NotFoundException(
        'Queue item tidak ditemukan atau bukan milik Anda',
      );
    }

    queue.assigned_pakar_id = null;
    queue.assigned_at = null;

    return this.queueRepository.save(queue);
  }

  /**
   * Pakar submit review (approve/reject/revision_needed)
   */
  async submitReview(
    protId: string,
    pakarId: string,
    reviewDto: VerifikasiReviewDto,
  ): Promise<Verifikasi> {
    // 1. Check if PROT exists and assigned to this pakar
    const queue = await this.queueRepository.findOne({
      where: { prot_id: protId, assigned_pakar_id: pakarId },
      relations: ['prot'],
    });

    if (!queue) {
      throw new ForbiddenException(
        'PROT ini tidak di-assign ke Anda atau tidak ada di queue',
      );
    }

    const prot = queue.prot;

    if (prot.status !== PROTStatus.DIKURASI) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa diverifikasi`,
      );
    }

    // 2. Create verifikasi record
    const verifikasi = this.verifikasiRepository.create({
      prot_id: protId,
      pakar_id: pakarId,
      status: reviewDto.status,
      catatan: reviewDto.catatan || null,
      saran_perbaikan: reviewDto.saran_perbaikan || null,
      dokumen_pendukung: reviewDto.dokumen_pendukung || null,
      verified_at: new Date(),
    });

    await this.verifikasiRepository.save(verifikasi);

    // 3. Update PROT status based on review decision
    switch (reviewDto.status) {
      case VerifikasiStatus.APPROVED:
        prot.status = PROTStatus.DIVERIFIKASI;
        prot.verified_by = pakarId;
        prot.verified_at = new Date();
        break;

      case VerifikasiStatus.REJECTED:
        prot.status = PROTStatus.DRAFT;
        prot.verified_by = null;
        prot.verified_at = null;
        break;

      case VerifikasiStatus.REVISION_NEEDED:
        prot.status = PROTStatus.REVISI;
        prot.verified_by = null;
        prot.verified_at = null;
        break;

      default:
        throw new BadRequestException('Status verifikasi tidak valid');
    }

    await this.protRepository.save(prot);

    // 4. Remove from queue
    await this.queueRepository.remove(queue);

    return verifikasi;
  }

  /**
   * Get verification history for a PROT
   */
  async getVerifikasiHistory(protId: string) {
    return this.verifikasiRepository.find({
      where: { prot_id: protId },
      relations: ['pakar'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get verification statistics
   */
  async getVerifikasiStats() {
    const [totalPending, totalApproved, totalRejected, totalRevision] =
      await Promise.all([
        this.queueRepository.count(),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.APPROVED },
        }),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.REJECTED },
        }),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.REVISION_NEEDED },
        }),
      ]);

    const totalProtByStatus = await this.protRepository
      .createQueryBuilder('prot')
      .select('prot.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('prot.status')
      .getRawMany();

    return {
      queue: {
        totalPending,
      },
      verifikasi: {
        totalApproved,
        totalRejected,
        totalRevision,
        total: totalApproved + totalRejected + totalRevision,
      },
      protByStatus: totalProtByStatus.reduce(
        (acc, item) => {
          acc[item.status] = parseInt(item.count, 10);
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
```

**Expected result:** Service dengan semua business logic untuk queue management dan review workflow.

---

## Task 8: Update PROTService (Ownership & Scoping)

**Files:**

- Edit: `src/modules/prot/prot.service.ts`

**Step 1: Update create() method**

Modify to inject `created_by`:

```typescript
async create(createProtDto: CreateProtDto, createdBy: string): Promise<PROT> {
  // Existing validation code...

  const prot = this.protRepository.create({
    ...createProtDto,
    created_by: createdBy,
    status: PROTStatus.DRAFT, // Explicit default
  });

  return this.protRepository.save(prot);
}
```

**Step 2: Add submitKurasi() method**

```typescript
async submitKurasi(protId: string, userId: string): Promise<PROT> {
  const prot = await this.protRepository.findOne({
    where: { id: protId },
  });

  if (!prot) {
    throw new NotFoundException('PROT tidak ditemukan');
  }

  // Check ownership
  if (prot.created_by !== userId) {
    throw new ForbiddenException('Anda bukan pemilik PROT ini');
  }

  // Check status
  if (prot.status !== PROTStatus.DRAFT) {
    throw new BadRequestException(
      `PROT dengan status ${prot.status} tidak bisa di-submit`,
    );
  }

  // Update status
  prot.status = PROTStatus.DIKURASI;
  prot.submitted_at = new Date();

  await this.protRepository.save(prot);

  // Create queue entry
  const queue = this.queueRepository.create({
    prot_id: protId,
    priority: 0,
  });

  await this.queueRepository.save(queue);

  return prot;
}
```

**Step 3: Add resubmitAfterRevisi() method**

```typescript
async resubmitAfterRevisi(protId: string, userId: string): Promise<PROT> {
  const prot = await this.protRepository.findOne({
    where: { id: protId },
  });

  if (!prot) {
    throw new NotFoundException('PROT tidak ditemukan');
  }

  // Check ownership
  if (prot.created_by !== userId) {
    throw new ForbiddenException('Anda bukan pemilik PROT ini');
  }

  // Check status
  if (prot.status !== PROTStatus.REVISI) {
    throw new BadRequestException(
      `PROT dengan status ${prot.status} tidak bisa di-resubmit`,
    );
  }

  // Update status
  prot.status = PROTStatus.DIKURASI;
  prot.submitted_at = new Date();

  await this.protRepository.save(prot);

  // Re-create queue entry
  const queue = this.queueRepository.create({
    prot_id: protId,
    priority: 0,
  });

  await this.queueRepository.save(queue);

  return prot;
}
```

**Step 4: Add publishToArsipNasional() method**

```typescript
async publishToArsipNasional(protId: string, adminId: string): Promise<PROT> {
  const prot = await this.protRepository.findOne({
    where: { id: protId },
  });

  if (!prot) {
    throw new NotFoundException('PROT tidak ditemukan');
  }

  // Check status
  if (prot.status !== PROTStatus.DIVERIFIKASI) {
    throw new BadRequestException(
      `PROT dengan status ${prot.status} tidak bisa dipublish. Harus DIVERIFIKASI dulu.`,
    );
  }

  // Update status
  prot.status = PROTStatus.ARSIP_NASIONAL;
  prot.published_by = adminId;
  prot.published_at = new Date();

  return this.protRepository.save(prot);
}
```

**Step 5: Update findAll() with status filtering**

Modify the findAll method to:

- Public users only see `ARSIP_NASIONAL`
- Kurator see their own PROT (any status) + ARSIP_NASIONAL
- Pakar see DIKURASI (assigned to them) + ARSIP_NASIONAL
- Admin see all

```typescript
async findAll(
  query: QueryProtDto,
  user?: User, // optional, from @CurrentUser
) {
  const qb = this.protRepository.createQueryBuilder('prot');

  // Status filter based on role
  if (!user || user.role === UserRole.PUBLIK) {
    // Public users only see published
    qb.andWhere('prot.status = :status', { status: PROTStatus.ARSIP_NASIONAL });
  } else if (user.role === UserRole.KURATOR_DAERAH) {
    // Kurator see own PROT or published
    qb.andWhere(
      '(prot.created_by = :userId OR prot.status = :arsipStatus)',
      { userId: user.id, arsipStatus: PROTStatus.ARSIP_NASIONAL },
    );
  } else if (user.role === UserRole.PAKAR) {
    // Pakar see assigned PROT or published
    // Note: assigned PROT tracked via verifikasi_queue, for now show all DIKURASI + ARSIP_NASIONAL
    qb.andWhere(
      '(prot.status IN (:...pakarStatuses))',
      { pakarStatuses: [PROTStatus.DIKURASI, PROTStatus.ARSIP_NASIONAL] },
    );
  }
  // Admin sees all (no filter)

  // Apply other filters (jenis, targetUsia, provinsi, etc.)
  // ... existing filter code

  // Pagination
  // ... existing pagination code
}
```

**Step 6: Update update() with ownership check**

```typescript
async update(
  id: string,
  updateProtDto: UpdateProtDto,
  userId: string,
  userRole: UserRole,
): Promise<PROT> {
  const prot = await this.findOne(id);

  // Check ownership (kurator can only edit own PROT, admin can edit all)
  if (userRole === UserRole.KURATOR_DAERAH && prot.created_by !== userId) {
    throw new ForbiddenException('Anda tidak memiliki akses untuk edit PROT ini');
  }

  // Check status (only DRAFT or REVISI can be edited)
  if (![PROTStatus.DRAFT, PROTStatus.REVISI].includes(prot.status)) {
    throw new BadRequestException(
      `PROT dengan status ${prot.status} tidak bisa diedit`,
    );
  }

  // ... rest of update logic
}
```

**Step 7: Inject dependencies**

Add to constructor:

```typescript
constructor(
  @InjectRepository(PROT)
  private protRepository: Repository<PROT>,
  @InjectRepository(VerifikasiQueue)
  private queueRepository: Repository<VerifikasiQueue>,
  private daerahService: DaerahService,
  private storageService: StorageService,
) {}
```

**Expected result:** PROT service now enforces ownership, status workflow, and role-based scoping.

---

## Task 9: Update PROTController (Inject CurrentUser)

**Files:**

- Edit: `src/modules/prot/prot.controller.ts`

**Step 1: Update create endpoint**

```typescript
@Post()
@Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
@UseInterceptors(AuditInterceptor)
async create(
  @Body() createProtDto: CreateProtDto,
  @CurrentUser() user: User,
) {
  return this.protService.create(createProtDto, user.id);
}
```

**Step 2: Update update endpoint**

```typescript
@Patch(':id')
@Roles(UserRole.KURATOR_DAERAH, UserRole.ADMIN_KPOTI)
@UseInterceptors(AuditInterceptor)
async update(
  @Param('id') id: string,
  @Body() updateProtDto: UpdateProtDto,
  @CurrentUser() user: User,
) {
  return this.protService.update(id, updateProtDto, user.id, user.role);
}
```

**Step 3: Update findAll endpoint**

```typescript
@Get()
@Public() // Still public, but behavior changes based on user
async findAll(
  @Query() query: QueryProtDto,
  @CurrentUser() user?: User, // Optional for public access
) {
  return this.protService.findAll(query, user);
}
```

**Step 4: Add submit-kurasi endpoint**

```typescript
@Post(':id/submit-kurasi')
@Roles(UserRole.KURATOR_DAERAH)
@UseInterceptors(AuditInterceptor)
async submitKurasi(
  @Param('id') id: string,
  @CurrentUser() user: User,
  @Body() submitDto: SubmitKurasiDto,
) {
  return this.protService.submitKurasi(id, user.id);
}
```

**Step 5: Add resubmit endpoint**

```typescript
@Post(':id/resubmit')
@Roles(UserRole.KURATOR_DAERAH)
@UseInterceptors(AuditInterceptor)
async resubmitAfterRevisi(
  @Param('id') id: string,
  @CurrentUser() user: User,
) {
  return this.protService.resubmitAfterRevisi(id, user.id);
}
```

**Step 6: Import dependencies**

```typescript
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { SubmitKurasiDto } from './dto/submit-kurasi.dto';
```

**Expected result:** PROT controller now passes user context to service methods.

---

## Task 10: Create VerifikasiController

**Files:**

- Create: `src/modules/prot/verifikasi.controller.ts`

**Step 1: Create controller file**

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { VerifikasiService } from './verifikasi.service';
import { PROTService } from './prot.service';
import { VerifikasiReviewDto } from './dto/verifikasi-review.dto';
import { PublishProtDto } from './dto/publish-prot.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('verifikasi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerifikasiController {
  constructor(
    private readonly verifikasiService: VerifikasiService,
    private readonly protService: PROTService,
  ) {}

  // PAKAR ENDPOINTS

  @Get('queue')
  @Roles(UserRole.PAKAR)
  async getAvailableQueue(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.verifikasiService.getAvailableQueue(page, limit);
  }

  @Get('my-queue')
  @Roles(UserRole.PAKAR)
  async getMyQueue(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.verifikasiService.getMyQueue(user.id, page, limit);
  }

  @Post('queue/:queueId/pick')
  @Roles(UserRole.PAKAR)
  @UseInterceptors(AuditInterceptor)
  async pickFromQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: User,
  ) {
    return this.verifikasiService.pickFromQueue(queueId, user.id);
  }

  @Post('queue/:queueId/release')
  @Roles(UserRole.PAKAR)
  @UseInterceptors(AuditInterceptor)
  async releaseFromQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: User,
  ) {
    return this.verifikasiService.releaseFromQueue(queueId, user.id);
  }

  @Post(':protId/review')
  @Roles(UserRole.PAKAR)
  @UseInterceptors(AuditInterceptor)
  async submitReview(
    @Param('protId') protId: string,
    @CurrentUser() user: User,
    @Body() reviewDto: VerifikasiReviewDto,
  ) {
    return this.verifikasiService.submitReview(protId, user.id, reviewDto);
  }

  @Get(':protId/history')
  @Roles(UserRole.PAKAR, UserRole.ADMIN_KPOTI, UserRole.KURATOR_DAERAH)
  async getVerifikasiHistory(@Param('protId') protId: string) {
    return this.verifikasiService.getVerifikasiHistory(protId);
  }

  // ADMIN ENDPOINTS

  @Post('prot/:protId/publish')
  @Roles(UserRole.ADMIN_KPOTI)
  @UseInterceptors(AuditInterceptor)
  async publishToArsipNasional(
    @Param('protId') protId: string,
    @CurrentUser() user: User,
    @Body() publishDto: PublishProtDto,
  ) {
    return this.protService.publishToArsipNasional(protId, user.id);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_KPOTI)
  async getVerifikasiStats() {
    return this.verifikasiService.getVerifikasiStats();
  }
}
```

**Expected result:** Complete REST API for pakar workflow dan admin publish.

---

## Task 11: Update PROTModule

**Files:**

- Edit: `src/modules/prot/prot.module.ts`

**Step 1: Update imports and providers**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PROTController } from './prot.controller';
import { PROTService } from './prot.service';
import { VerifikasiController } from './verifikasi.controller';
import { VerifikasiService } from './verifikasi.service';
import { PROT } from './entities/prot.entity';
import { Verifikasi } from './entities/verifikasi.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { DaerahModule } from '../daerah/daerah.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PROT, Verifikasi, VerifikasiQueue]),
    DaerahModule,
    StorageModule,
    AuditModule,
    UsersModule,
  ],
  controllers: [PROTController, VerifikasiController],
  providers: [PROTService, VerifikasiService],
  exports: [PROTService, VerifikasiService],
})
export class PROTModule {}
```

**Expected result:** Module wiring complete dengan semua dependencies.

---

## Task 12: Run Migration

**Files:**

- N/A (terminal command)

**Step 1: Generate migration timestamp**

```bash
npm run typeorm migration:run
```

**Step 2: Verify migration**

Check database:

- `prot` table has new columns
- `verifikasi` and `verifikasi_queue` tables created
- Enums created
- Indexes created
- Existing PROT records have `status = 'DRAFT'` and `created_by` set

**Expected result:** Database schema updated successfully.

---

## Task 13: Testing

**Files:**

- Create: `src/modules/prot/verifikasi.service.spec.ts`
- Edit: `src/modules/prot/prot.service.spec.ts`

**Step 1: Test status transitions**

Test cases:

- ✅ DRAFT → DIKURASI (submit kurasi)
- ✅ DIKURASI → DIVERIFIKASI (approve)
- ✅ DIKURASI → DRAFT (reject)
- ✅ DIKURASI → REVISI (revision needed)
- ✅ REVISI → DIKURASI (resubmit)
- ✅ DIVERIFIKASI → ARSIP_NASIONAL (publish)
- ❌ DRAFT → DIVERIFIKASI (skip kurasi) — should fail
- ❌ REVISI → DIVERIFIKASI (skip re-kurasi) — should fail

**Step 2: Test ownership**

- ✅ Kurator can edit own PROT
- ❌ Kurator cannot edit other kurator's PROT
- ✅ Admin can edit any PROT

**Step 3: Test queue concurrency**

- ✅ Pakar A picks queue item
- ❌ Pakar B cannot pick the same item (already assigned)
- ✅ Pakar A releases, then Pakar B can pick

**Step 4: Test role enforcement**

- ❌ Publik cannot access verifikasi endpoints
- ❌ Kurator cannot access pakar endpoints
- ✅ Pakar can access queue and review
- ✅ Admin can publish

**Expected result:** All tests passing with proper coverage.

---

## Task 14: Documentation Update

**Files:**

- Create: `docs/api/verifikasi-api.md`
- Update: `README.md`

**Step 1: Document workflow**

Create comprehensive API documentation covering:

- Status flow diagram
- Role permissions matrix
- Endpoint specifications
- Request/response examples
- Error scenarios

**Step 2: Update README**

Add section on verification workflow:

- How to submit PROT for verification
- How pakar pick and review
- How admin publish

**Expected result:** Clear documentation for developers and users.

---

## Task 15: Postman Collection Update

**Files:**

- Edit: `docs/postman/Nusantara_Play_PROT_API.postman_collection.json`

**Step 1: Add verifikasi endpoints**

Add requests for:

- GET /verifikasi/queue
- GET /verifikasi/my-queue
- POST /verifikasi/queue/:queueId/pick
- POST /verifikasi/queue/:queueId/release
- POST /verifikasi/:protId/review
- GET /verifikasi/:protId/history
- POST /verifikasi/prot/:protId/publish
- GET /verifikasi/stats
- POST /prot/:id/submit-kurasi
- POST /prot/:id/resubmit

**Expected result:** Complete Postman collection for testing all endpoints.

---

## Verification Checklist

Before marking this plan as complete:

- [ ] Migration runs successfully without errors
- [ ] All entities properly created with relations
- [ ] Status transitions work as designed
- [ ] Ownership checks prevent unauthorized edits
- [ ] Pakar can pick, release, and review PROT
- [ ] Admin can publish DIVERIFIKASI to ARSIP_NASIONAL
- [ ] Public users only see ARSIP_NASIONAL PROT
- [ ] Kurator only see own PROT + ARSIP_NASIONAL
- [ ] Queue concurrency handled (no double-pick)
- [ ] Audit logs created for all mutations
- [ ] Unit tests passing for service methods
- [ ] E2E test covering full workflow
- [ ] API documentation complete
- [ ] Postman collection updated

---

## Rollback Plan

If issues arise:

1. **Rollback migration:**

   ```bash
   npm run typeorm migration:revert
   ```

2. **Remove new files:**
   - `src/modules/prot/entities/verifikasi.entity.ts`
   - `src/modules/prot/entities/verifikasi-queue.entity.ts`
   - `src/modules/prot/verifikasi.service.ts`
   - `src/modules/prot/verifikasi.controller.ts`
   - DTOs in `src/modules/prot/dto/`

3. **Revert changes to existing files:**
   - Use git to revert `prot.entity.ts`, `prot.service.ts`, `prot.controller.ts`, `prot.module.ts`

---

## Future Enhancements (Out of Scope for This Plan)

- [ ] Email/in-app notifications on status change
- [ ] Dashboard analytics for pakar performance
- [ ] Bulk actions (reject multiple, publish multiple)
- [ ] Priority scoring algorithm for queue
- [ ] SLA tracking (berapa lama di queue)
- [ ] Reassign PROT from one pakar to another (admin feature)
- [ ] Pakar expertise matching (auto-assign based on daerah/jenis)
- [ ] Version control for PROT (track changes between revisions)

---

_End of Plan_
