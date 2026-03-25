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
