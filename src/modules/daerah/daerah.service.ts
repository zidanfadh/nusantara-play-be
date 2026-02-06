import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Daerah, DaerahLevel } from './entities/daerah.entity';

@Injectable()
export class DaerahService {
  constructor(
    @InjectRepository(Daerah)
    private daerahRepository: Repository<Daerah>,
  ) {}

  async findAll(filters?: {
    level?: DaerahLevel;
    provinsi?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Daerah[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.level) {
      where.level = filters.level;
    }
    if (filters?.provinsi) {
      where.provinsi = filters.provinsi;
    }

    const [data, total] = await this.daerahRepository.findAndCount({
      where,
      order: { provinsi: 'ASC', nama: 'ASC' },
      skip,
      take: limit,
    });

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

  async findById(id: string): Promise<Daerah> {
    const daerah = await this.daerahRepository.findOne({ where: { id } });
    if (!daerah) {
      throw new NotFoundException(`Daerah with ID ${id} not found`);
    }
    return daerah;
  }

  async findByLevel(level: DaerahLevel, page: number = 1, limit: number = 10) {
    return this.findAll({ level, page, limit });
  }

  async findProvinces(pagination?: { page: number; limit: number }) {
    return this.findByLevel(
      DaerahLevel.PROVINSI,
      pagination?.page || 1,
      pagination?.limit || 10,
    );
  }

  async findByProvinsi(provinsi: string, page: number = 1, limit: number = 10) {
    return this.findAll({ provinsi, page, limit });
  }

  async findChildren(parentId: string, page: number = 1, limit: number = 10) {
    const pg = page || 1;
    const lim = limit || 10;
    const skip = (pg - 1) * lim;

    const [data, total] = await this.daerahRepository.findAndCount({
      where: { parent_id: parentId },
      order: { nama: 'ASC' },
      skip,
      take: lim,
    });

    const totalPages = Math.ceil(total / lim);

    return {
      data,
      pagination: {
        total,
        page: pg,
        limit: lim,
        totalPages,
        hasNext: pg < totalPages,
        hasPrev: pg > 1,
      },
    };
  }

  async findByKode(kode: string): Promise<Daerah> {
    const daerah = await this.daerahRepository.findOne({ where: { kode } });
    if (!daerah) {
      throw new NotFoundException(`Daerah with code ${kode} not found`);
    }
    return daerah;
  }

  async count(): Promise<number> {
    return this.daerahRepository.count();
  }

  async countByLevel(level: DaerahLevel): Promise<number> {
    return this.daerahRepository.count({ where: { level } });
  }
}
