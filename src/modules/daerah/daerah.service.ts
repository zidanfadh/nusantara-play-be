import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Daerah, DaerahLevel } from './entities/daerah.entity';

@Injectable()
export class DaerahService {
  constructor(
    @InjectRepository(Daerah)
    private daerahRepository: Repository<Daerah>,
  ) { }

  private paginate(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findAll(filters?: {
    level?: DaerahLevel;
    provinsi?: string;
    parentId?: string;
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
    if (filters?.parentId) {
      where.parent_id = filters.parentId;
    }

    const [data, total] = await this.daerahRepository.findAndCount({
      where,
      order: { provinsi: 'ASC', nama: 'ASC' },
      skip,
      take: limit,
    });

    return { data, pagination: this.paginate(total, page, limit) };
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

  async findByProvinsi(
    provinsi: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll({ provinsi, page, limit });
  }

  async findChildren(parentId: string, page: number = 1, limit: number = 50) {
    const pg = page || 1;
    const lim = limit || 50;
    const skip = (pg - 1) * lim;

    const [data, total] = await this.daerahRepository.findAndCount({
      where: { parent_id: parentId },
      order: { kode: 'ASC', nama: 'ASC' },
      skip,
      take: lim,
    });

    return { data, pagination: this.paginate(total, pg, lim) };
  }

  async findByKode(kode: string): Promise<Daerah> {
    const daerah = await this.daerahRepository.findOne({ where: { kode } });
    if (!daerah) {
      throw new NotFoundException(`Daerah with code ${kode} not found`);
    }
    return daerah;
  }

  /**
   * Get children of a daerah identified by its kode (useful for cascading dropdowns).
   */
  async findChildrenByKode(
    kode: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const parent = await this.findByKode(kode);
    return this.findChildren(parent.id, page, limit);
  }

  /**
   * Search daerah by name (case-insensitive LIKE). Optionally filter by level.
   */
  async search(
    q: string,
    filters?: { level?: DaerahLevel; page?: number; limit?: number },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { nama: ILike(`%${q}%`) };
    if (filters?.level) {
      where.level = filters.level;
    }

    const [data, total] = await this.daerahRepository.findAndCount({
      where,
      order: { level: 'ASC', nama: 'ASC' },
      skip,
      take: limit,
    });

    return { data, pagination: this.paginate(total, page, limit) };
  }

  /**
   * Get the full ancestor chain (breadcrumb) for a daerah, from root (provinsi) down to the item itself.
   * Returns an array ordered from highest level (provinsi) to the given daerah.
   */
  async findAncestors(id: string): Promise<Daerah[]> {
    const ancestors: Daerah[] = [];
    let current = await this.findById(id);
    ancestors.unshift(current);

    while (current.parent_id) {
      current = await this.findById(current.parent_id);
      ancestors.unshift(current);
    }

    return ancestors;
  }

  /**
   * Get ancestors by kode instead of id.
   */
  async findAncestorsByKode(kode: string): Promise<Daerah[]> {
    const daerah = await this.findByKode(kode);
    return this.findAncestors(daerah.id);
  }

  async count(): Promise<number> {
    return this.daerahRepository.count();
  }

  async countByLevel(level: DaerahLevel): Promise<number> {
    return this.daerahRepository.count({ where: { level } });
  }
}
