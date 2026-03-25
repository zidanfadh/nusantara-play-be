# Marketplace MVP Backend — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a marketplace module for Nusantara Play — any user can open a Toko, list
physical products (with optional PROT links), buyers can place orders with seller
confirmation and shipment tracking. No payment gateway.

**Architecture:** Single NestJS `MarketplaceModule` with 4 services (KategoriProduk, Toko,
Produk, Order). Ownership enforced via `ForbiddenException` in service layer. TypeORM
transactions for stock management. Follows patterns from existing `events` and `prot` modules.

**Design doc:** `docs/plans/2026-03-20-marketplace-backend-design.md`

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL, class-validator, class-transformer

---

## Task 1: Create Migration

**Files:**
- Create: `src/migrations/1743000000000-CreateMarketplace.ts`

**Step 1: Create the migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketplace1743000000000 implements MigrationInterface {
  name = 'CreateMarketplace1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE kategori_produk (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        nama       varchar NOT NULL,
        slug       varchar NOT NULL UNIQUE,
        deskripsi  text,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE toko (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nama       varchar NOT NULL,
        slug       varchar NOT NULL UNIQUE,
        deskripsi  text,
        logo_url   varchar,
        alamat     text,
        phone      varchar,
        whatsapp   varchar,
        is_active  boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_toko_user ON toko(user_id)`);

    await queryRunner.query(`
      CREATE TABLE produk (
        id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        toko_id     uuid NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
        kategori_id uuid REFERENCES kategori_produk(id) ON DELETE SET NULL,
        nama        varchar NOT NULL,
        slug        varchar NOT NULL,
        deskripsi   text,
        harga       numeric(15,2) NOT NULL,
        stok        integer NOT NULL DEFAULT 0,
        images      jsonb,
        is_active   boolean NOT NULL DEFAULT true,
        created_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (toko_id, slug)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_produk_toko ON produk(toko_id)`);
    await queryRunner.query(`CREATE INDEX idx_produk_kategori ON produk(kategori_id)`);
    await queryRunner.query(`CREATE INDEX idx_produk_active ON produk(is_active)`);

    await queryRunner.query(`
      CREATE TABLE produk_prot (
        produk_id uuid NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
        prot_id   uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        PRIMARY KEY (produk_id, prot_id)
      )
    `);

    await queryRunner.query(`
      CREATE TYPE order_status AS ENUM (
        'menunggu', 'dikonfirmasi', 'dikirim', 'selesai', 'dibatalkan'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_order (
        id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        buyer_id         uuid NOT NULL REFERENCES users(id),
        toko_id          uuid NOT NULL REFERENCES toko(id),
        status           order_status NOT NULL DEFAULT 'menunggu',
        total_harga      numeric(15,2) NOT NULL,
        shipping_address jsonb NOT NULL,
        catatan          text,
        kurir_pengiriman varchar,
        nomor_resi       varchar,
        created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_buyer ON marketplace_order(buyer_id)`);
    await queryRunner.query(`CREATE INDEX idx_order_toko ON marketplace_order(toko_id)`);
    await queryRunner.query(`CREATE INDEX idx_order_status ON marketplace_order(status)`);

    await queryRunner.query(`
      CREATE TABLE order_item (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id     uuid NOT NULL REFERENCES marketplace_order(id) ON DELETE CASCADE,
        produk_id    uuid NOT NULL REFERENCES produk(id),
        nama_produk  varchar NOT NULL,
        qty          integer NOT NULL,
        harga_satuan numeric(15,2) NOT NULL,
        subtotal     numeric(15,2) NOT NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_item_order ON order_item(order_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_item CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_order CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS produk_prot CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS produk CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS toko CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS kategori_produk CASCADE`);
  }
}
```

**Step 2: Run migration**

```bash
cd nusantara-play-backend
npm run migration:run
```

Expected: migration succeeds, 7 tables/types created without errors.

**Step 3: Commit**

```bash
git add src/migrations/1743000000000-CreateMarketplace.ts
git commit -m "feat(marketplace): add migration for marketplace tables"
```

---

## Task 2: Create Entities

**Files:**
- Create: `src/modules/marketplace/entities/kategori-produk.entity.ts`
- Create: `src/modules/marketplace/entities/toko.entity.ts`
- Create: `src/modules/marketplace/entities/produk.entity.ts`
- Create: `src/modules/marketplace/entities/produk-prot.entity.ts`
- Create: `src/modules/marketplace/entities/order.entity.ts`
- Create: `src/modules/marketplace/entities/order-item.entity.ts`
- Create: `src/modules/marketplace/entities/index.ts`

**Step 1: Create `kategori-produk.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('kategori_produk')
export class KategoriProduk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  deskripsi: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
```

**Step 2: Create `toko.entity.ts`**

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
import { User } from '../../users/entities/user.entity';

@Entity('toko')
export class Toko {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column()
  nama: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  deskripsi: string | null;

  @Column({ name: 'logo_url', nullable: true })
  logo_url: string | null;

  @Column({ type: 'text', nullable: true })
  alamat: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  whatsapp: string | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

**Step 3: Create `produk.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  ValueTransformer,
} from 'typeorm';
import { Toko } from './toko.entity';
import { KategoriProduk } from './kategori-produk.entity';
import { PROT } from '../../prot/entities/prot.entity';

const JsonArrayTransformer: ValueTransformer = {
  to: (value: any) => JSON.stringify(value),
  from: (value: any) => {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
};

@Entity('produk')
export class Produk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'toko_id', type: 'uuid' })
  toko_id: string;

  @Column({ name: 'kategori_id', type: 'uuid', nullable: true })
  kategori_id: string | null;

  @Column()
  nama: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  deskripsi: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  harga: number;

  @Column({ type: 'int', default: 0 })
  stok: number;

  @Column({ type: 'jsonb', nullable: true, transformer: JsonArrayTransformer })
  images: string[] | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Toko, { nullable: false })
  @JoinColumn({ name: 'toko_id' })
  toko: Toko;

  @ManyToOne(() => KategoriProduk, { nullable: true })
  @JoinColumn({ name: 'kategori_id' })
  kategori: KategoriProduk | null;

  @ManyToMany(() => PROT)
  @JoinTable({
    name: 'produk_prot',
    joinColumn: { name: 'produk_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'prot_id', referencedColumnName: 'id' },
  })
  prots: PROT[];
}
```

**Step 4: Create `produk-prot.entity.ts`**

```typescript
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Produk } from './produk.entity';
import { PROT } from '../../prot/entities/prot.entity';

@Entity('produk_prot')
export class ProdukProt {
  @PrimaryColumn({ name: 'produk_id', type: 'uuid' })
  produk_id: string;

  @PrimaryColumn({ name: 'prot_id', type: 'uuid' })
  prot_id: string;

  @ManyToOne(() => Produk)
  @JoinColumn({ name: 'produk_id' })
  produk: Produk;

  @ManyToOne(() => PROT)
  @JoinColumn({ name: 'prot_id' })
  prot: PROT;
}
```

**Step 5: Create `order.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Toko } from './toko.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  MENUNGGU = 'menunggu',
  DIKONFIRMASI = 'dikonfirmasi',
  DIKIRIM = 'dikirim',
  SELESAI = 'selesai',
  DIBATALKAN = 'dibatalkan',
}

export interface ShippingAddress {
  nama_penerima: string;
  phone: string;
  alamat_lengkap: string;
  kota: string;
  provinsi: string;
  kode_pos?: string;
}

@Entity('marketplace_order')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'buyer_id', type: 'uuid' })
  buyer_id: string;

  @Column({ name: 'toko_id', type: 'uuid' })
  toko_id: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.MENUNGGU })
  status: OrderStatus;

  @Column({ name: 'total_harga', type: 'decimal', precision: 15, scale: 2 })
  total_harga: number;

  @Column({ name: 'shipping_address', type: 'jsonb' })
  shipping_address: ShippingAddress;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({ name: 'kurir_pengiriman', nullable: true })
  kurir_pengiriman: string | null;

  @Column({ name: 'nomor_resi', nullable: true })
  nomor_resi: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @ManyToOne(() => Toko, { nullable: false })
  @JoinColumn({ name: 'toko_id' })
  toko: Toko;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
```

**Step 6: Create `order-item.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Produk } from './produk.entity';

@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  order_id: string;

  @Column({ name: 'produk_id', type: 'uuid' })
  produk_id: string;

  @Column({ name: 'nama_produk' })
  nama_produk: string;

  @Column({ type: 'int' })
  qty: number;

  @Column({ name: 'harga_satuan', type: 'decimal', precision: 15, scale: 2 })
  harga_satuan: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: number;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Produk, { nullable: false })
  @JoinColumn({ name: 'produk_id' })
  produk: Produk;
}
```

**Step 7: Create `entities/index.ts`**

```typescript
export { KategoriProduk } from './kategori-produk.entity';
export { Toko } from './toko.entity';
export { Produk } from './produk.entity';
export { ProdukProt } from './produk-prot.entity';
export { Order, OrderStatus, ShippingAddress } from './order.entity';
export { OrderItem } from './order-item.entity';
```

**Step 8: Commit**

```bash
git add src/modules/marketplace/
git commit -m "feat(marketplace): add TypeORM entities"
```

---

## Task 3: KategoriProduk Service + Controller

**Files:**
- Create: `src/modules/marketplace/dto/create-kategori.dto.ts`
- Create: `src/modules/marketplace/dto/update-kategori.dto.ts`
- Create: `src/modules/marketplace/__tests__/kategori-produk.service.spec.ts`
- Create: `src/modules/marketplace/kategori-produk.service.ts`
- Create: `src/modules/marketplace/kategori-produk.controller.ts`

**Step 1: Create DTOs**

`src/modules/marketplace/dto/create-kategori.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateKategoriDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nama: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung' })
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;
}
```

`src/modules/marketplace/dto/update-kategori.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateKategoriDto } from './create-kategori.dto';

export class UpdateKategoriDto extends PartialType(CreateKategoriDto) {}
```

**Step 2: Write failing test**

`src/modules/marketplace/__tests__/kategori-produk.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { KategoriProdukService } from '../kategori-produk.service';
import { KategoriProduk } from '../entities/kategori-produk.entity';

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('KategoriProdukService', () => {
  let service: KategoriProdukService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KategoriProdukService,
        { provide: getRepositoryToken(KategoriProduk), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<KategoriProdukService>(KategoriProdukService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ id: 'uuid', nama: 'Peralatan', slug: 'peralatan' });
      mockRepo.save.mockResolvedValue({ id: 'uuid', nama: 'Peralatan', slug: 'peralatan' });

      const result = await service.create({ nama: 'Peralatan', slug: 'peralatan' });

      expect(result.nama).toBe('Peralatan');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when slug already exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'existing', slug: 'peralatan' });

      await expect(
        service.create({ nama: 'Peralatan', slug: 'peralatan' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [{ id: '1', nama: 'Peralatan', slug: 'peralatan' }];
      mockRepo.find.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should return category by id', async () => {
      const category = { id: 'uuid', nama: 'Peralatan', slug: 'peralatan' };
      mockRepo.findOne.mockResolvedValue(category);

      const result = await service.findOne('uuid');

      expect(result).toEqual(category);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove category', async () => {
      const category = { id: 'uuid', nama: 'Peralatan', slug: 'peralatan' };
      mockRepo.findOne.mockResolvedValue(category);
      mockRepo.remove.mockResolvedValue(category);

      await service.remove('uuid');

      expect(mockRepo.remove).toHaveBeenCalledWith(category);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=kategori-produk.service
```

Expected: FAIL — `Cannot find module '../kategori-produk.service'`

**Step 4: Implement service**

`src/modules/marketplace/kategori-produk.service.ts`:
```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KategoriProduk } from './entities/kategori-produk.entity';
import { CreateKategoriDto } from './dto/create-kategori.dto';
import { UpdateKategoriDto } from './dto/update-kategori.dto';

@Injectable()
export class KategoriProdukService {
  constructor(
    @InjectRepository(KategoriProduk)
    private readonly repo: Repository<KategoriProduk>,
  ) {}

  async create(dto: CreateKategoriDto): Promise<KategoriProduk> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);
    }
    const kategori = this.repo.create(dto);
    return this.repo.save(kategori);
  }

  async findAll(): Promise<KategoriProduk[]> {
    return this.repo.find({ order: { nama: 'ASC' } });
  }

  async findOne(id: string): Promise<KategoriProduk> {
    const kategori = await this.repo.findOne({ where: { id } });
    if (!kategori) {
      throw new NotFoundException(`Kategori dengan id '${id}' tidak ditemukan`);
    }
    return kategori;
  }

  async update(id: string, dto: UpdateKategoriDto): Promise<KategoriProduk> {
    const kategori = await this.findOne(id);
    if (dto.slug && dto.slug !== kategori.slug) {
      const existing = await this.repo.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);
      }
    }
    Object.assign(kategori, dto);
    return this.repo.save(kategori);
  }

  async remove(id: string): Promise<void> {
    const kategori = await this.findOne(id);
    await this.repo.remove(kategori);
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=kategori-produk.service
```

Expected: PASS — all 5 tests pass.

**Step 6: Create controller**

`src/modules/marketplace/kategori-produk.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { KategoriProdukService } from './kategori-produk.service';
import { CreateKategoriDto } from './dto/create-kategori.dto';
import { UpdateKategoriDto } from './dto/update-kategori.dto';

@Controller('marketplace/kategori')
export class KategoriProdukController {
  constructor(private readonly service: KategoriProdukService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles('admin_kpoti')
  @Post()
  create(@Body() dto: CreateKategoriDto) {
    return this.service.create(dto);
  }

  @Roles('admin_kpoti')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKategoriDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin_kpoti')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
```

**Step 7: Commit**

```bash
git add src/modules/marketplace/
git commit -m "feat(marketplace): add KategoriProduk service and controller"
```

---

## Task 4: Toko Service + Controller

**Files:**
- Create: `src/modules/marketplace/dto/create-toko.dto.ts`
- Create: `src/modules/marketplace/dto/update-toko.dto.ts`
- Create: `src/modules/marketplace/__tests__/toko.service.spec.ts`
- Create: `src/modules/marketplace/toko.service.ts`
- Create: `src/modules/marketplace/toko.controller.ts`

**Step 1: Create DTOs**

`src/modules/marketplace/dto/create-toko.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateTokoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nama: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung' })
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsString()
  @IsOptional()
  logo_url?: string;

  @IsString()
  @IsOptional()
  alamat?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;
}
```

`src/modules/marketplace/dto/update-toko.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTokoDto } from './create-toko.dto';

export class UpdateTokoDto extends PartialType(CreateTokoDto) {}
```

**Step 2: Write failing test**

`src/modules/marketplace/__tests__/toko.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TokoService } from '../toko.service';
import { Toko } from '../entities/toko.entity';

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('TokoService', () => {
  let service: TokoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokoService,
        { provide: getRepositoryToken(Toko), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TokoService>(TokoService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new toko for user', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // no existing toko for user
      mockRepo.findOne.mockResolvedValueOnce(null); // slug not taken
      mockRepo.create.mockReturnValue({ id: 'uuid', user_id: 'user-1', nama: 'Toko A', slug: 'toko-a' });
      mockRepo.save.mockResolvedValue({ id: 'uuid', user_id: 'user-1', nama: 'Toko A', slug: 'toko-a' });

      const result = await service.create('user-1', { nama: 'Toko A', slug: 'toko-a' });

      expect(result.nama).toBe('Toko A');
    });

    it('should throw ConflictException when user already has a toko', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 'existing', user_id: 'user-1' });

      await expect(
        service.create('user-1', { nama: 'Toko B', slug: 'toko-b' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when slug already taken', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // no toko for user
      mockRepo.findOne.mockResolvedValueOnce({ id: 'other', slug: 'toko-a' }); // slug taken

      await expect(
        service.create('user-1', { nama: 'Toko A', slug: 'toko-a' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findMy', () => {
    it('should return user toko', async () => {
      const toko = { id: 'uuid', user_id: 'user-1', nama: 'Toko A' };
      mockRepo.findOne.mockResolvedValue(toko);

      const result = await service.findMy('user-1');

      expect(result).toEqual(toko);
    });

    it('should throw NotFoundException when user has no toko', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findMy('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when user does not own toko', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'uuid', user_id: 'other-user' });

      await expect(
        service.update('uuid', 'user-1', { nama: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=toko.service
```

Expected: FAIL — `Cannot find module '../toko.service'`

**Step 4: Implement service**

`src/modules/marketplace/toko.service.ts`:
```typescript
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Toko } from './entities/toko.entity';
import { CreateTokoDto } from './dto/create-toko.dto';
import { UpdateTokoDto } from './dto/update-toko.dto';

@Injectable()
export class TokoService {
  constructor(
    @InjectRepository(Toko)
    private readonly repo: Repository<Toko>,
  ) {}

  async create(userId: string, dto: CreateTokoDto): Promise<Toko> {
    const existingForUser = await this.repo.findOne({ where: { user_id: userId } });
    if (existingForUser) {
      throw new ConflictException('Anda sudah memiliki toko');
    }
    const slugTaken = await this.repo.findOne({ where: { slug: dto.slug } });
    if (slugTaken) {
      throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);
    }
    const toko = this.repo.create({ ...dto, user_id: userId });
    return this.repo.save(toko);
  }

  async findAll(): Promise<Toko[]> {
    return this.repo.find({ where: { is_active: true }, order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Toko> {
    const toko = await this.repo.findOne({ where: { id } });
    if (!toko) {
      throw new NotFoundException(`Toko dengan id '${id}' tidak ditemukan`);
    }
    return toko;
  }

  async findMy(userId: string): Promise<Toko> {
    const toko = await this.repo.findOne({ where: { user_id: userId } });
    if (!toko) {
      throw new NotFoundException('Anda belum memiliki toko');
    }
    return toko;
  }

  async update(id: string, userId: string, dto: UpdateTokoDto): Promise<Toko> {
    const toko = await this.findOne(id);
    if (toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke toko ini');
    }
    if (dto.slug && dto.slug !== toko.slug) {
      const slugTaken = await this.repo.findOne({ where: { slug: dto.slug } });
      if (slugTaken) {
        throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);
      }
    }
    Object.assign(toko, dto);
    return this.repo.save(toko);
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=toko.service
```

Expected: PASS — all 6 tests pass.

**Step 6: Create controller**

`src/modules/marketplace/toko.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TokoService } from './toko.service';
import { CreateTokoDto } from './dto/create-toko.dto';
import { UpdateTokoDto } from './dto/update-toko.dto';

@Controller('marketplace/toko')
export class TokoController {
  constructor(private readonly service: TokoService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('my')
  findMy(@CurrentUser() user: any) {
    return this.service.findMy(user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTokoDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTokoDto,
  ) {
    return this.service.update(id, user.id, dto);
  }
}
```

**Step 7: Commit**

```bash
git add src/modules/marketplace/
git commit -m "feat(marketplace): add Toko service and controller"
```

---

## Task 5: Produk Service + Controller

**Files:**
- Create: `src/modules/marketplace/dto/create-produk.dto.ts`
- Create: `src/modules/marketplace/dto/update-produk.dto.ts`
- Create: `src/modules/marketplace/dto/query-produk.dto.ts`
- Create: `src/modules/marketplace/dto/link-prot.dto.ts`
- Create: `src/modules/marketplace/__tests__/produk.service.spec.ts`
- Create: `src/modules/marketplace/produk.service.ts`
- Create: `src/modules/marketplace/produk.controller.ts`

**Step 1: Create DTOs**

`src/modules/marketplace/dto/create-produk.dto.ts`:
```typescript
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsArray,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProdukDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nama: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung' })
  @MaxLength(200)
  slug: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  harga: number;

  @IsInt()
  @Min(0)
  stok: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsUUID()
  @IsOptional()
  kategori_id?: string;
}
```

`src/modules/marketplace/dto/update-produk.dto.ts`:
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateProdukDto } from './create-produk.dto';

export class UpdateProdukDto extends PartialType(CreateProdukDto) {}
```

`src/modules/marketplace/dto/query-produk.dto.ts`:
```typescript
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class QueryProdukDto {
  @IsUUID()
  @IsOptional()
  toko_id?: string;

  @IsUUID()
  @IsOptional()
  kategori_id?: string;

  @IsUUID()
  @IsOptional()
  prot_id?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
```

`src/modules/marketplace/dto/link-prot.dto.ts`:
```typescript
import { IsUUID } from 'class-validator';

export class LinkProtDto {
  @IsUUID()
  prot_id: string;
}
```

**Step 2: Write failing test**

`src/modules/marketplace/__tests__/produk.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProdukService } from '../produk.service';
import { Produk } from '../entities/produk.entity';
import { Toko } from '../entities/toko.entity';
import { PROT } from '../../prot/entities/prot.entity';

const mockProdukRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};
const mockTokoRepo = { findOne: jest.fn() };
const mockProtRepo = { findOne: jest.fn() };

describe('ProdukService', () => {
  let service: ProdukService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdukService,
        { provide: getRepositoryToken(Produk), useValue: mockProdukRepo },
        { provide: getRepositoryToken(Toko), useValue: mockTokoRepo },
        { provide: getRepositoryToken(PROT), useValue: mockProtRepo },
      ],
    }).compile();

    service = module.get<ProdukService>(ProdukService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw NotFoundException when user has no toko', async () => {
      mockTokoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', { nama: 'Produk A', slug: 'produk-a', harga: 50000, stok: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create product for toko owner', async () => {
      mockTokoRepo.findOne.mockResolvedValue({ id: 'toko-1', user_id: 'user-1' });
      mockProdukRepo.findOne.mockResolvedValue(null);
      const product = { id: 'prod-1', toko_id: 'toko-1', nama: 'Produk A', prots: [] };
      mockProdukRepo.create.mockReturnValue(product);
      mockProdukRepo.save.mockResolvedValue(product);

      const result = await service.create('user-1', {
        nama: 'Produk A',
        slug: 'produk-a',
        harga: 50000,
        stok: 10,
      });

      expect(result.nama).toBe('Produk A');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when product not found', async () => {
      mockProdukRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when user does not own the product toko', async () => {
      mockProdukRepo.findOne.mockResolvedValue({
        id: 'prod-1',
        toko_id: 'toko-1',
        toko: { user_id: 'other-user' },
      });

      await expect(
        service.update('prod-1', 'user-1', { nama: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=produk.service
```

Expected: FAIL — `Cannot find module '../produk.service'`

**Step 4: Implement service**

`src/modules/marketplace/produk.service.ts`:
```typescript
import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produk } from './entities/produk.entity';
import { Toko } from './entities/toko.entity';
import { PROT } from '../prot/entities/prot.entity';
import { CreateProdukDto } from './dto/create-produk.dto';
import { UpdateProdukDto } from './dto/update-produk.dto';
import { QueryProdukDto } from './dto/query-produk.dto';

@Injectable()
export class ProdukService {
  constructor(
    @InjectRepository(Produk)
    private readonly produkRepo: Repository<Produk>,
    @InjectRepository(Toko)
    private readonly tokoRepo: Repository<Toko>,
    @InjectRepository(PROT)
    private readonly protRepo: Repository<PROT>,
  ) {}

  async create(userId: string, dto: CreateProdukDto): Promise<Produk> {
    const toko = await this.tokoRepo.findOne({ where: { user_id: userId } });
    if (!toko) {
      throw new NotFoundException(
        'Anda belum memiliki toko. Daftar sebagai penjual terlebih dahulu.',
      );
    }
    const slugTaken = await this.produkRepo.findOne({
      where: { toko_id: toko.id, slug: dto.slug },
    });
    if (slugTaken) {
      throw new ConflictException(`Slug '${dto.slug}' sudah digunakan di toko ini`);
    }
    const produk = this.produkRepo.create({ ...dto, toko_id: toko.id, prots: [] });
    return this.produkRepo.save(produk);
  }

  async findAll(query: QueryProdukDto): Promise<Produk[]> {
    const qb = this.produkRepo
      .createQueryBuilder('produk')
      .leftJoinAndSelect('produk.toko', 'toko')
      .leftJoinAndSelect('produk.kategori', 'kategori')
      .leftJoinAndSelect('produk.prots', 'prot')
      .where('produk.is_active = true');

    if (query.toko_id) {
      qb.andWhere('produk.toko_id = :toko_id', { toko_id: query.toko_id });
    }
    if (query.kategori_id) {
      qb.andWhere('produk.kategori_id = :kategori_id', { kategori_id: query.kategori_id });
    }
    if (query.prot_id) {
      qb.andWhere('prot.id = :prot_id', { prot_id: query.prot_id });
    }
    if (query.search) {
      qb.andWhere('produk.nama ILIKE :search', { search: `%${query.search}%` });
    }

    return qb.orderBy('produk.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Produk> {
    const produk = await this.produkRepo.findOne({
      where: { id },
      relations: ['toko', 'kategori', 'prots'],
    });
    if (!produk) {
      throw new NotFoundException(`Produk dengan id '${id}' tidak ditemukan`);
    }
    return produk;
  }

  async update(id: string, userId: string, dto: UpdateProdukDto): Promise<Produk> {
    const produk = await this.produkRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!produk) {
      throw new NotFoundException(`Produk dengan id '${id}' tidak ditemukan`);
    }
    if (produk.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke produk ini');
    }
    if (dto.slug && dto.slug !== produk.slug) {
      const slugTaken = await this.produkRepo.findOne({
        where: { toko_id: produk.toko_id, slug: dto.slug },
      });
      if (slugTaken) {
        throw new ConflictException(`Slug '${dto.slug}' sudah digunakan di toko ini`);
      }
    }
    Object.assign(produk, dto);
    return this.produkRepo.save(produk);
  }

  async remove(id: string, userId: string): Promise<void> {
    const produk = await this.produkRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!produk) {
      throw new NotFoundException(`Produk dengan id '${id}' tidak ditemukan`);
    }
    if (produk.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke produk ini');
    }
    produk.is_active = false;
    await this.produkRepo.save(produk);
  }

  async linkProt(id: string, userId: string, protId: string): Promise<Produk> {
    const produk = await this.produkRepo.findOne({
      where: { id },
      relations: ['toko', 'prots'],
    });
    if (!produk) {
      throw new NotFoundException(`Produk dengan id '${id}' tidak ditemukan`);
    }
    if (produk.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke produk ini');
    }
    const prot = await this.protRepo.findOne({ where: { id: protId } });
    if (!prot) {
      throw new NotFoundException(`PROT dengan id '${protId}' tidak ditemukan`);
    }
    if (!produk.prots.some((p) => p.id === protId)) {
      produk.prots.push(prot);
      await this.produkRepo.save(produk);
    }
    return produk;
  }

  async unlinkProt(id: string, userId: string, protId: string): Promise<void> {
    const produk = await this.produkRepo.findOne({
      where: { id },
      relations: ['toko', 'prots'],
    });
    if (!produk) {
      throw new NotFoundException(`Produk dengan id '${id}' tidak ditemukan`);
    }
    if (produk.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke produk ini');
    }
    produk.prots = produk.prots.filter((p) => p.id !== protId);
    await this.produkRepo.save(produk);
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=produk.service
```

Expected: PASS — all 4 tests pass.

**Step 6: Create controller**

`src/modules/marketplace/produk.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProdukService } from './produk.service';
import { CreateProdukDto } from './dto/create-produk.dto';
import { UpdateProdukDto } from './dto/update-produk.dto';
import { QueryProdukDto } from './dto/query-produk.dto';
import { LinkProtDto } from './dto/link-prot.dto';

@Controller('marketplace/produk')
export class ProdukController {
  constructor(private readonly service: ProdukService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryProdukDto) {
    return this.service.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProdukDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateProdukDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }

  @Post(':id/prot')
  linkProt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: LinkProtDto,
  ) {
    return this.service.linkProt(id, user.id, dto.prot_id);
  }

  @Delete(':id/prot/:protId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkProt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('protId', ParseUUIDPipe) protId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlinkProt(id, user.id, protId);
  }
}
```

**Step 7: Commit**

```bash
git add src/modules/marketplace/
git commit -m "feat(marketplace): add Produk service and controller"
```

---

## Task 6: Order Service + Controller

**Files:**
- Create: `src/modules/marketplace/dto/create-order.dto.ts`
- Create: `src/modules/marketplace/dto/kirim-order.dto.ts`
- Create: `src/modules/marketplace/__tests__/order.service.spec.ts`
- Create: `src/modules/marketplace/order.service.ts`
- Create: `src/modules/marketplace/order.controller.ts`

**Step 1: Create DTOs**

`src/modules/marketplace/dto/create-order.dto.ts`:
```typescript
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  nama_penerima: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  alamat_lengkap: string;

  @IsString()
  @IsNotEmpty()
  kota: string;

  @IsString()
  @IsNotEmpty()
  provinsi: string;

  @IsString()
  @IsOptional()
  kode_pos?: string;
}

export class OrderItemDto {
  @IsUUID()
  produk_id: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateOrderDto {
  @IsUUID()
  toko_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shipping_address: ShippingAddressDto;

  @IsString()
  @IsOptional()
  catatan?: string;
}
```

`src/modules/marketplace/dto/kirim-order.dto.ts`:
```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class KirimOrderDto {
  @IsString()
  @IsNotEmpty()
  kurir_pengiriman: string;

  @IsString()
  @IsNotEmpty()
  nomor_resi: string;
}
```

**Step 2: Write failing test**

`src/modules/marketplace/__tests__/order.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from '../order.service';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Produk } from '../entities/produk.entity';
import { Toko } from '../entities/toko.entity';

const mockOrderRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockOrderItemRepo = { create: jest.fn() };
const mockProdukRepo = { findOne: jest.fn() };
const mockTokoRepo = { findOne: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: mockOrderItemRepo },
        { provide: getRepositoryToken(Produk), useValue: mockProdukRepo },
        { provide: getRepositoryToken(Toko), useValue: mockTokoRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  describe('create', () => {
    it('should throw NotFoundException when toko not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.create('buyer-1', {
          toko_id: 'nonexistent',
          items: [{ produk_id: 'prod-1', qty: 1 }],
          shipping_address: {
            nama_penerima: 'Test',
            phone: '08123',
            alamat_lengkap: 'Jl. Test',
            kota: 'Jakarta',
            provinsi: 'DKI Jakarta',
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when buyer is the toko owner', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ id: 'toko-1', user_id: 'buyer-1' });

      await expect(
        service.create('buyer-1', {
          toko_id: 'toko-1',
          items: [{ produk_id: 'prod-1', qty: 1 }],
          shipping_address: {
            nama_penerima: 'Test',
            phone: '08123',
            alamat_lengkap: 'Jl. Test',
            kota: 'Jakarta',
            provinsi: 'DKI Jakarta',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('konfirmasi', () => {
    it('should throw ForbiddenException when non-seller tries to confirm', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order is not in MENUNGGU status', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.DIKONFIRMASI,
        toko: { user_id: 'seller-1' },
      });

      await expect(service.konfirmasi('order-1', 'seller-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('batalkan', () => {
    it('should throw ForbiddenException when non-participant tries to cancel', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        buyer_id: 'buyer-1',
        status: OrderStatus.MENUNGGU,
        toko: { user_id: 'seller-1' },
        items: [],
      });

      await expect(service.batalkan('order-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=order.service
```

Expected: FAIL — `Cannot find module '../order.service'`

**Step 4: Implement service**

`src/modules/marketplace/order.service.ts`:
```typescript
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Produk } from './entities/produk.entity';
import { Toko } from './entities/toko.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { KirimOrderDto } from './dto/kirim-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Produk)
    private readonly produkRepo: Repository<Produk>,
    @InjectRepository(Toko)
    private readonly tokoRepo: Repository<Toko>,
    private readonly dataSource: DataSource,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const toko = await qr.manager.findOne(Toko, { where: { id: dto.toko_id } });
      if (!toko) {
        throw new NotFoundException('Toko tidak ditemukan');
      }
      if (toko.user_id === buyerId) {
        throw new BadRequestException('Anda tidak dapat membeli dari toko sendiri');
      }

      let totalHarga = 0;
      const itemEntities: Partial<OrderItem>[] = [];

      for (const item of dto.items) {
        const produk = await qr.manager.findOne(Produk, {
          where: { id: item.produk_id, toko_id: dto.toko_id, is_active: true },
        });
        if (!produk) {
          throw new NotFoundException(`Produk '${item.produk_id}' tidak ditemukan di toko ini`);
        }
        if (produk.stok < item.qty) {
          throw new BadRequestException(`Stok produk '${produk.nama}' tidak mencukupi`);
        }
        produk.stok -= item.qty;
        await qr.manager.save(Produk, produk);

        const subtotal = Number(produk.harga) * item.qty;
        totalHarga += subtotal;
        itemEntities.push({
          produk_id: produk.id,
          nama_produk: produk.nama,
          qty: item.qty,
          harga_satuan: Number(produk.harga),
          subtotal,
        });
      }

      const order = qr.manager.create(Order, {
        buyer_id: buyerId,
        toko_id: dto.toko_id,
        total_harga: totalHarga,
        shipping_address: dto.shipping_address,
        catatan: dto.catatan ?? null,
        status: OrderStatus.MENUNGGU,
      });
      const savedOrder = await qr.manager.save(Order, order);

      for (const item of itemEntities) {
        const orderItem = qr.manager.create(OrderItem, { ...item, order_id: savedOrder.id });
        await qr.manager.save(OrderItem, orderItem);
      }

      await qr.commitTransaction();
      return this.orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['toko', 'buyer', 'items'],
      });
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findMyOrders(buyerId: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: { buyer_id: buyerId },
      relations: ['toko', 'items'],
      order: { created_at: 'DESC' },
    });
  }

  async findSellerOrders(userId: string): Promise<Order[]> {
    const toko = await this.tokoRepo.findOne({ where: { user_id: userId } });
    if (!toko) {
      throw new NotFoundException('Anda belum memiliki toko');
    }
    return this.orderRepo.find({
      where: { toko_id: toko.id },
      relations: ['buyer', 'items'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko', 'buyer', 'items', 'items.produk'],
    });
    if (!order) {
      throw new NotFoundException('Order tidak ditemukan');
    }
    if (order.buyer_id !== userId && order.toko.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }
    return order;
  }

  async konfirmasi(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException('Hanya penjual yang dapat mengkonfirmasi order');
    }
    if (order.status !== OrderStatus.MENUNGGU) {
      throw new BadRequestException('Order tidak dalam status MENUNGGU');
    }
    order.status = OrderStatus.DIKONFIRMASI;
    return this.orderRepo.save(order);
  }

  async kirim(id: string, userId: string, dto: KirimOrderDto): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.toko.user_id !== userId) {
      throw new ForbiddenException('Hanya penjual yang dapat memperbarui pengiriman');
    }
    if (order.status !== OrderStatus.DIKONFIRMASI) {
      throw new BadRequestException('Order harus dalam status DIKONFIRMASI untuk dikirim');
    }
    order.status = OrderStatus.DIKIRIM;
    order.kurir_pengiriman = dto.kurir_pengiriman;
    order.nomor_resi = dto.nomor_resi;
    return this.orderRepo.save(order);
  }

  async selesai(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['toko'] });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.buyer_id !== userId) {
      throw new ForbiddenException('Hanya pembeli yang dapat menandai order selesai');
    }
    if (order.status !== OrderStatus.DIKIRIM) {
      throw new BadRequestException('Order harus dalam status DIKIRIM untuk diselesaikan');
    }
    order.status = OrderStatus.SELESAI;
    return this.orderRepo.save(order);
  }

  async batalkan(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['toko', 'items'],
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.toko.user_id === userId;
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    const cancellableByBuyer = isBuyer && order.status === OrderStatus.MENUNGGU;
    const cancellableBySeller =
      isSeller &&
      (order.status === OrderStatus.MENUNGGU || order.status === OrderStatus.DIKONFIRMASI);
    if (!cancellableByBuyer && !cancellableBySeller) {
      throw new BadRequestException(
        `Order tidak dapat dibatalkan pada status ${order.status}`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const item of order.items) {
        const produk = await qr.manager.findOne(Produk, { where: { id: item.produk_id } });
        if (produk) {
          produk.stok += item.qty;
          await qr.manager.save(Produk, produk);
        }
      }
      order.status = OrderStatus.DIBATALKAN;
      await qr.manager.save(Order, order);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return order;
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=order.service
```

Expected: PASS — all 5 tests pass.

**Step 6: Create controller**

`src/modules/marketplace/order.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { KirimOrderDto } from './dto/kirim-order.dto';

@Controller('marketplace/order')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findMyOrders(@CurrentUser() user: any) {
    return this.service.findMyOrders(user.id);
  }

  @Get('seller')
  findSellerOrders(@CurrentUser() user: any) {
    return this.service.findSellerOrders(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id/konfirmasi')
  konfirmasi(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.konfirmasi(id, user.id);
  }

  @Patch(':id/kirim')
  kirim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: KirimOrderDto,
  ) {
    return this.service.kirim(id, user.id, dto);
  }

  @Patch(':id/selesai')
  selesai(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.selesai(id, user.id);
  }

  @Patch(':id/batalkan')
  batalkan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.batalkan(id, user.id);
  }
}
```

**Step 7: Commit**

```bash
git add src/modules/marketplace/
git commit -m "feat(marketplace): add Order service and controller"
```

---

## Task 7: Wire MarketplaceModule + Register in AppModule

**Files:**
- Create: `src/modules/marketplace/marketplace.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Read current AppModule to find the imports array**

```bash
cat src/app.module.ts
```

Note which modules are already imported so you add `MarketplaceModule` in the right place.

**Step 2: Create `marketplace.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KategoriProduk } from './entities/kategori-produk.entity';
import { Toko } from './entities/toko.entity';
import { Produk } from './entities/produk.entity';
import { ProdukProt } from './entities/produk-prot.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PROT } from '../prot/entities/prot.entity';
import { KategoriProdukService } from './kategori-produk.service';
import { TokoService } from './toko.service';
import { ProdukService } from './produk.service';
import { OrderService } from './order.service';
import { KategoriProdukController } from './kategori-produk.controller';
import { TokoController } from './toko.controller';
import { ProdukController } from './produk.controller';
import { OrderController } from './order.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KategoriProduk,
      Toko,
      Produk,
      ProdukProt,
      Order,
      OrderItem,
      PROT,
    ]),
  ],
  controllers: [
    KategoriProdukController,
    TokoController,
    ProdukController,
    OrderController,
  ],
  providers: [
    KategoriProdukService,
    TokoService,
    ProdukService,
    OrderService,
  ],
})
export class MarketplaceModule {}
```

**Step 3: Add MarketplaceModule to AppModule**

In `src/app.module.ts`:
1. Add import: `import { MarketplaceModule } from './modules/marketplace/marketplace.module';`
2. Add `MarketplaceModule` to the `imports` array (after existing modules)

**Step 4: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: BUILD SUCCESS — zero compilation errors.

**Step 5: Run all tests**

```bash
npm test
```

Expected: all existing tests pass + 16 new marketplace tests pass.

**Step 6: Start dev server and smoke test**

```bash
npm run start:dev
```

Then verify these endpoints respond (no auth needed):
- `GET /api/marketplace/kategori` → `200 []`
- `GET /api/marketplace/toko` → `200 []`
- `GET /api/marketplace/produk` → `200 []`

**Step 7: Commit**

```bash
git add src/modules/marketplace/marketplace.module.ts src/app.module.ts
git commit -m "feat(marketplace): wire MarketplaceModule into AppModule"
```

---

## Summary

| Task | What gets built |
|------|----------------|
| 1 | Migration — 6 tables + 1 enum type |
| 2 | 6 TypeORM entities |
| 3 | KategoriProduk CRUD (admin-managed) |
| 4 | Toko CRUD (any user, one per account) |
| 5 | Produk CRUD + PROT link/unlink |
| 6 | Order flow (place → confirm → ship → complete/cancel) |
| 7 | Wire module + smoke test |

**New files total:** 1 migration + 7 entities + 10 DTOs + 4 services + 4 controllers + 4 tests + 1 module = **31 files**

**Existing files touched:** `src/app.module.ts` only
