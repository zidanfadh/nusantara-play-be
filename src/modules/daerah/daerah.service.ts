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

  async findAll(): Promise<Daerah[]> {
    return this.daerahRepository.find({
      order: { provinsi: 'ASC', nama: 'ASC' },
    });
  }

  async findById(id: string): Promise<Daerah> {
    const daerah = await this.daerahRepository.findOne({ where: { id } });
    if (!daerah) {
      throw new NotFoundException(`Daerah with ID ${id} not found`);
    }
    return daerah;
  }

  async findByLevel(level: DaerahLevel): Promise<Daerah[]> {
    return this.daerahRepository.find({
      where: { level },
      order: { nama: 'ASC' },
    });
  }

  async findProvinces(): Promise<Daerah[]> {
    return this.findByLevel(DaerahLevel.PROVINSI);
  }

  async findByProvinsi(provinsi: string): Promise<Daerah[]> {
    return this.daerahRepository.find({
      where: { provinsi },
      order: { nama: 'ASC' },
    });
  }

  async findChildren(parentId: string): Promise<Daerah[]> {
    return this.daerahRepository.find({
      where: { parent_id: parentId },
      order: { nama: 'ASC' },
    });
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
