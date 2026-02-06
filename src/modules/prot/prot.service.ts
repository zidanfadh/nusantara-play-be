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
    const dto = updatePROTDto as Partial<CreatePROTDto>;
    if (
      dto.provinsiKode !== undefined ||
      dto.kabkotaKode !== undefined ||
      dto.kecamatanKode !== undefined ||
      dto.desaKode !== undefined
    ) {
      await this.validateDaerahKode({
        ...prot,
        ...dto,
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
