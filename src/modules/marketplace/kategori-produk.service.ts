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
