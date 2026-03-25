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
