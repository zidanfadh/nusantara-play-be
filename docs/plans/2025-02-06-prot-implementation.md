# PROT API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build PROT (Permainan Rakyat dan Olahraga Tradisional) API module with CRUD operations, file upload support, and location-based filtering.

**Architecture:** NestJS module with TypeORM entity, service layer with pagination/filtering, controller with multipart file upload, and integration with existing StorageService and DaerahService.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (jsonb), Multer (file upload), AWS S3 (storage)

---

## Task 1: Create PROT Entity

**Files:**
- Create: `src/modules/prot/entities/prot.entity.ts`

**Step 1: Create the entity file**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PROTJenis {
  PERMAINAN_RAKYAT = 'PERMAINAN_RAKYAT',
  OLAHRAGA_TRADISIONAL = 'OLAHRAGA_TRADISIONAL',
}

export enum TargetUsia {
  ANAK = 'ANAK',
  REMAJA = 'REMAJA',
  DEWASA = 'DEWASA',
  SEMUA_USIA = 'SEMUA_USIA',
}

export interface Peralatan {
  nama: string;
  deskripsi?: string;
  kisaranHarga?: string;
  fotoAlat?: string[];
}

@Entity('prot')
export class PROT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nama: string;

  @Column({
    type: 'enum',
    enum: PROTJenis,
  })
  jenis: PROTJenis;

  @Column({ type: 'text', nullable: true })
  statusAsalUsul: string;

  @Column({ nullable: true })
  provinsiKode: string;

  @Column({ nullable: true })
  kabkotaKode: string;

  @Column({ nullable: true })
  kecamatanKode: string;

  @Column({ nullable: true })
  desaKode: string;

  @Column({ nullable: true })
  alamatLengkap: string;

  @Column({ type: 'text', nullable: true })
  caraBermain: string;

  @Column({ type: 'text', nullable: true })
  nilaiMoral: string;

  @Column({
    type: 'enum',
    enum: TargetUsia,
  })
  targetUsia: TargetUsia;

  @Column({ type: 'jsonb', nullable: true })
  peralatan: Peralatan[];

  @Column({ type: 'jsonb', nullable: true })
  fotoKegiatan: string[];

  @Column({ type: 'jsonb', nullable: true })
  videoKegiatan: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

**Step 2: Run linter to check**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/modules/prot/entities/prot.entity.ts
git commit -m "feat: add PROT entity with enums and jsonb fields"
```

---

## Task 2: Create DTOs

**Files:**
- Create: `src/modules/prot/dto/create-prot.dto.ts`
- Create: `src/modules/prot/dto/update-prot.dto.ts`
- Create: `src/modules/prot/dto/query-prot.dto.ts`
- Create: `src/modules/prot/dto/peralatan.dto.ts`

**Step 1: Create PeralatanDto**

```typescript
import { IsString, IsOptional, IsArray } from 'class-validator';

export class PeralatanDto {
  @IsString()
  nama: string;

  @IsString()
  @IsOptional()
  deskripsi?: string;

  @IsString()
  @IsOptional()
  kisaranHarga?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fotoAlat?: string[];
}
```

**Step 2: Create CreatePROTDto**

```typescript
import { IsString, IsEnum, IsOptional, IsArray, MinLength } from 'class-validator';
import { PROTJenis, TargetUsia } from '../entities/prot.entity';
import { PeralatanDto } from './peralatan.dto';

export class CreatePROTDto {
  @IsString()
  @MinLength(3)
  nama: string;

  @IsEnum(PROTJenis)
  jenis: PROTJenis;

  @IsString()
  @IsOptional()
  statusAsalUsul?: string;

  @IsString()
  @IsOptional()
  provinsiKode?: string;

  @IsString()
  @IsOptional()
  kabkotaKode?: string;

  @IsString()
  @IsOptional()
  kecamatanKode?: string;

  @IsString()
  @IsOptional()
  desaKode?: string;

  @IsString()
  @IsOptional()
  alamatLengkap?: string;

  @IsString()
  @IsOptional()
  caraBermain?: string;

  @IsString()
  @IsOptional()
  nilaiMoral?: string;

  @IsEnum(TargetUsia)
  targetUsia: TargetUsia;

  @IsArray()
  @IsOptional()
  peralatan?: PeralatanDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fotoKegiatan?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videoKegiatan?: string[];
}
```

**Step 3: Create UpdatePROTDto**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreatePROTDto } from './create-prot.dto';

export class UpdatePROTDto extends PartialType(CreatePROTDto) {}
```

**Step 4: Create QueryPROTDto**

```typescript
import { IsOptional, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PROTJenis, TargetUsia } from '../entities/prot.entity';

export class QueryPROTDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @IsEnum(PROTJenis)
  jenis?: PROTJenis;

  @IsOptional()
  @IsString()
  provinsi?: string;

  @IsOptional()
  @IsString()
  kabkota?: string;

  @IsOptional()
  @IsString()
  kecamatan?: string;

  @IsOptional()
  @IsString()
  desa?: string;

  @IsOptional()
  @IsEnum(TargetUsia)
  targetUsia?: TargetUsia;

  @IsOptional()
  @IsString()
  search?: string;
}
```

**Step 5: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/modules/prot/dto/
git commit -m "feat: add PROT DTOs for create, update, and query"
```

---

## Task 3: Create PROT Service

**Files:**
- Create: `src/modules/prot/prot.service.ts`

**Step 1: Create service file**

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROT, PROTJenis, TargetUsia } from './entities/prot.entity';
import { CreatePROTDto } from './dto/create-prot.dto';
import { UpdatePROTDto } from './dto/update-prot.dto';
import { QueryPROTDto } from './dto/query-prot.dto';
import { DaerahService } from '../daerah/daerah.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PROTService {
  constructor(
    @InjectRepository(PROT)
    private protRepository: Repository<PROT>,
    private daerahService: DaerahService,
    private storageService: StorageService,
  ) {}

  async create(createPROTDto: CreatePROTDto): Promise<PROT> {
    // Validate daerah cascade
    await this.validateDaerahKode(createPROTDto);

    const prot = this.protRepository.create(createPROTDto);
    return this.protRepository.save(prot);
  }

  async findAll(query: QueryPROTDto): Promise<{
    data: PROT[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.protRepository.createQueryBuilder('prot');

    if (query.jenis) {
      queryBuilder.andWhere('prot.jenis = :jenis', { jenis: query.jenis });
    }

    if (query.provinsi) {
      queryBuilder.andWhere('prot.provinsiKode = :provinsi', {
        provinsi: query.provinsi,
      });
    }

    if (query.kabkota) {
      queryBuilder.andWhere('prot.kabkotaKode = :kabkota', {
        kabkota: query.kabkota,
      });
    }

    if (query.kecamatan) {
      queryBuilder.andWhere('prot.kecamatanKode = :kecamatan', {
        kecamatan: query.kecamatan,
      });
    }

    if (query.desa) {
      queryBuilder.andWhere('prot.desaKode = :desa', { desa: query.desa });
    }

    if (query.targetUsia) {
      queryBuilder.andWhere('prot.targetUsia = :targetUsia', {
        targetUsia: query.targetUsia,
      });
    }

    if (query.search) {
      queryBuilder.andWhere('prot.nama ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<PROT> {
    const prot = await this.protRepository.findOne({ where: { id } });
    if (!prot) {
      throw new NotFoundException(`PROT with ID ${id} not found`);
    }
    return prot;
  }

  async update(id: string, updatePROTDto: UpdatePROTDto): Promise<PROT> {
    const prot = await this.findOne(id);

    // Validate daerah cascade if provided
    if (
      updatePROTDto.provinsiKode ||
      updatePROTDto.kabkotaKode ||
      updatePROTDto.kecamatanKode ||
      updatePROTDto.desaKode
    ) {
      await this.validateDaerahKode({
        ...prot,
        ...updatePROTDto,
      } as CreatePROTDto);
    }

    Object.assign(prot, updatePROTDto);
    return this.protRepository.save(prot);
  }

  async remove(id: string): Promise<void> {
    const prot = await this.findOne(id);
    await this.protRepository.remove(prot);
  }

  async addFotoKegiatan(
    id: string,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/foto-kegiatan')),
    );

    prot.fotoKegiatan = prot.fotoKegiatan || [];
    prot.fotoKegiatan.push(...urls);

    return this.protRepository.save(prot);
  }

  async addVideoKegiatan(
    id: string,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/video-kegiatan')),
    );

    prot.videoKegiatan = prot.videoKegiatan || [];
    prot.videoKegiatan.push(...urls);

    return this.protRepository.save(prot);
  }

  async removeFotoKegiatan(id: string, index: number): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.fotoKegiatan || prot.fotoKegiatan.length === 0) {
      throw new BadRequestException('No foto kegiatan to remove');
    }

    if (index < 0 || index >= prot.fotoKegiatan.length) {
      throw new BadRequestException(`Invalid index: ${index}`);
    }

    // Delete file from S3
    await this.storageService.deleteFile(prot.fotoKegiatan[index]);

    prot.fotoKegiatan.splice(index, 1);
    return this.protRepository.save(prot);
  }

  async removeVideoKegiatan(id: string, index: number): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.videoKegiatan || prot.videoKegiatan.length === 0) {
      throw new BadRequestException('No video kegiatan to remove');
    }

    if (index < 0 || index >= prot.videoKegiatan.length) {
      throw new BadRequestException(`Invalid index: ${index}`);
    }

    // Delete file from S3
    await this.storageService.deleteFile(prot.videoKegiatan[index]);

    prot.videoKegiatan.splice(index, 1);
    return this.protRepository.save(prot);
  }

  private async validateDaerahKode(dto: CreatePROTDto): Promise<void> {
    // Cascade validation: if child is provided, parent must be provided and valid
    if (dto.desaKode) {
      if (!dto.kecamatanKode) {
        throw new BadRequestException('kecamatanKode is required when desaKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.desaKode);
      } catch {
        throw new BadRequestException(`Invalid desaKode: ${dto.desaKode}`);
      }
    }

    if (dto.kecamatanKode) {
      if (!dto.kabkotaKode) {
        throw new BadRequestException('kabkotaKode is required when kecamatanKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.kecamatanKode);
      } catch {
        throw new BadRequestException(`Invalid kecamatanKode: ${dto.kecamatanKode}`);
      }
    }

    if (dto.kabkotaKode) {
      if (!dto.provinsiKode) {
        throw new BadRequestException('provinsiKode is required when kabkotaKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.kabkotaKode);
      } catch {
        throw new BadRequestException(`Invalid kabkotaKode: ${dto.kabkotaKode}`);
      }
    }

    if (dto.provinsiKode) {
      try {
        await this.daerahService.findByKode(dto.provinsiKode);
      } catch {
        throw new BadRequestException(`Invalid provinsiKode: ${dto.provinsiKode}`);
      }
    }
  }
}
```

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/modules/prot/prot.service.ts
git commit -m "feat: add PROT service with CRUD and file upload methods"
```

---

## Task 4: Create PROT Controller

**Files:**
- Create: `src/modules/prot/prot.controller.ts`

**Step 1: Create controller file**

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PROTService } from './prot.service';
import { CreatePROTDto } from './dto/create-prot.dto';
import { UpdatePROTDto } from './dto/update-prot.dto';
import { QueryPROTDto } from './dto/query-prot.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('prot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PROTController {
  constructor(private readonly protService: PROTService) {}

  @Post()
  @Roles('kurator_daerah', 'admin_kpoti')
  async create(@Body() createPROTDto: CreatePROTDto) {
    return this.protService.create(createPROTDto);
  }

  @Get()
  @Public()
  async findAll(@Query() query: QueryPROTDto) {
    return this.protService.findAll(query);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.protService.findOne(id);
  }

  @Patch(':id')
  @Roles('kurator_daerah', 'admin_kpoti')
  async update(
    @Param('id') id: string,
    @Body() updatePROTDto: UpdatePROTDto,
  ) {
    return this.protService.update(id, updatePROTDto);
  }

  @Put(':id')
  @Roles('kurator_daerah', 'admin_kpoti')
  async updateFull(
    @Param('id') id: string,
    @Body() updatePROTDto: UpdatePROTDto,
  ) {
    return this.protService.update(id, updatePROTDto);
  }

  @Delete(':id')
  @Roles('admin_kpoti')
  async remove(@Param('id') id: string) {
    await this.protService.remove(id);
    return { message: 'PROT deleted successfully' };
  }

  @Post(':id/foto-kegiatan')
  @Roles('kurator_daerah', 'admin_kpoti')
  @UseInterceptors(FilesInterceptor('files', 10))
  async addFotoKegiatan(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return this.protService.addFotoKegiatan(id, files);
  }

  @Post(':id/video-kegiatan')
  @Roles('kurator_daerah', 'admin_kpoti')
  @UseInterceptors(FilesInterceptor('files', 10))
  async addVideoKegiatan(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return this.protService.addVideoKegiatan(id, files);
  }

  @Delete(':id/foto-kegiatan/:index')
  @Roles('kurator_daerah', 'admin_kpoti')
  async removeFotoKegiatan(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.protService.removeFotoKegiatan(id, index);
  }

  @Delete(':id/video-kegiatan/:index')
  @Roles('kurator_daerah', 'admin_kpoti')
  async removeVideoKegiatan(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.protService.removeVideoKegiatan(id, index);
  }
}
```

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/modules/prot/prot.controller.ts
git commit -m "feat: add PROT controller with CRUD and file upload endpoints"
```

---

## Task 5: Create PROT Module

**Files:**
- Create: `src/modules/prot/prot.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Create PROT module**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PROTService } from './prot.service';
import { PROTController } from './prot.controller';
import { PROT } from './entities/prot.entity';
import { StorageModule } from '../storage/storage.module';
import { DaerahModule } from '../daerah/daerah.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PROT]),
    StorageModule,
    DaerahModule,
  ],
  controllers: [PROTController],
  providers: [PROTService],
  exports: [PROTService],
})
export class PROTModule {}
```

**Step 2: Register in AppModule**

Read `src/app.module.ts` and add PROTModule to imports array:

```typescript
import { PROTModule } from './modules/prot/prot.module';

@Module({
  imports: [
    // ... existing imports
    PROTModule,
  ],
  // ...
})
```

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/modules/prot/prot.module.ts src/app.module.ts
git commit -m "feat: add PROT module and register in AppModule"
```

---

## Task 6: Update StorageService File Validation

**Files:**
- Modify: `src/modules/storage/storage.service.ts`

**Step 1: Update validateFile method**

Change file size limit to 100MB and add webp, mov mime types:

```typescript
private validateFile(file: Express.Multer.File): void {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/quicktime', // .mov files
  ];

  if (file.size > maxSize) {
    throw new BadRequestException('File size exceeds 100MB limit');
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
    );
  }
}
```

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/modules/storage/storage.service.ts
git commit -m "feat: increase file size limit to 100MB and add webp, mov support"
```

---

## Task 7: Create Migration

**Files:**
- Create migration file via NestJS CLI

**Step 1: Generate migration**

Run: `npm run typeorm migration:generate -- src/migrations/CreatePROT`

**Step 2: Review generated migration**

Check the generated migration file in `src/migrations/` folder. It should contain:
- CREATE TABLE for prot with all columns
- ENUM types for PROT_JENIS and TARGET_USIA

**Step 3: Run migration**

Run: `npm run typeorm migration:run`

**Step 4: Verify table created**

Run: `npm run typeorm query "SELECT * FROM prot LIMIT 1"`
Expected: Empty result or error (table exists but no data)

**Step 5: Commit**

```bash
git add src/migrations/
git commit -m "feat: create PROT table migration"
```

---

## Task 8: Manual Testing

**Step 1: Start dev server**

Run: `npm run start:dev`

**Step 2: Test create PROT (POST /api/prot)**

```bash
curl -X POST http://localhost:3000/api/prot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nama": "Gasing",
    "jenis": "PERMAINAN_RAKYAT",
    "statusAsalUsul": "Permainan tradisional dari Indonesia",
    "provinsiKode": "11", // example code
    "targetUsia": "ANAK",
    "caraBermain": "Putar gasing dengan tali",
    "nilaiMoral": "Melatih kesabaran dan ketelitian",
    "peralatan": [{
      "nama": "Gasing",
      "deskripsi": "Gasing kayu",
      "kisaranHarga": "10000-50000"
    }]
  }'
```

Expected: 201 Created with PROT object

**Step 3: Test list (GET /api/prot)**

```bash
curl http://localhost:3000/api/prot?page=1&limit=10
```

Expected: 200 OK with data array and pagination

**Step 4: Test detail (GET /api/prot/:id)**

```bash
curl http://localhost:3000/api/prot/{id_from_step_2}
```

Expected: 200 OK with PROT object

**Step 5: Test update (PATCH /api/prot/:id)**

```bash
curl -X PATCH http://localhost:3000/api/prot/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"nama": "Gasing Aceh"}'
```

Expected: 200 OK with updated PROT

**Step 6: Test upload foto kegiatan**

```bash
curl -X POST http://localhost:3000/api/prot/{id}/foto-kegiatan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@/path/to/image.jpg"
```

Expected: 200 OK with updated fotoKegiatan array

**Step 7: Test filter by jenis**

```bash
curl "http://localhost:3000/api/prot?jenis=PERMAINAN_RAKYAT"
```

Expected: 200 OK with filtered results

**Step 8: Test search**

```bash
curl "http://localhost:3000/api/prot?search=gasing"
```

Expected: 200 OK with search results

**Step 9: Test delete (DELETE /api/prot/:id)**

```bash
curl -X DELETE http://localhost:3000/api/prot/{id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: 200 OK with success message

---

## Summary

After completing all tasks, you should have:
- PROT entity with enums and jsonb fields
- Complete DTOs for create, update, and query operations
- Service layer with CRUD, pagination, filtering, and file upload methods
- Controller with all endpoints and proper guards
- Module registered in AppModule
- Migration for PROT table
- Updated StorageService with 100MB limit and additional mime types
