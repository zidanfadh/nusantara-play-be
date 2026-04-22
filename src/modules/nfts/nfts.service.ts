import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NftCatalog, NftCatalogStatus } from './entities/nft-catalog.entity';
import { PROT } from '../prot/entities/prot.entity';
import { StorageService } from '../storage/storage.service';
import { CreateNftDto } from './dto/create-nft.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { QueryNftsDto } from './dto/query-nfts.dto';

@Injectable()
export class NftsService {
  constructor(
    @InjectRepository(NftCatalog)
    private readonly nftRepository: Repository<NftCatalog>,
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateNftDto): Promise<NftCatalog> {
    await this.validateProt(dto.prot_id);
    await this.assertSlugAvailable(dto.slug);
    await this.assertBlockchainIdentityAvailable(
      dto.blockchain_network,
      dto.contract_address,
      dto.token_id,
    );

    const nft = this.nftRepository.create({
      ...dto,
      status: NftCatalogStatus.DRAFT,
      is_active: true,
      created_by: userId,
      updated_by: userId,
      published_at: null,
    });

    return this.nftRepository.save(nft);
  }

  async findAll(query: QueryNftsDto): Promise<{
    data: NftCatalog[];
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
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.nftRepository
      .createQueryBuilder('nft')
      .leftJoinAndSelect('nft.prot', 'prot')
      .where('nft.is_active = true')
      .andWhere('nft.status = :status', { status: NftCatalogStatus.PUBLISHED });

    if (query.blockchain_network) {
      queryBuilder.andWhere('nft.blockchain_network = :blockchain_network', {
        blockchain_network: query.blockchain_network,
      });
    }

    if (query.prot_id) {
      queryBuilder.andWhere('nft.prot_id = :prot_id', { prot_id: query.prot_id });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(nft.nama ILIKE :search OR nft.deskripsi ILIKE :search OR nft.about ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder.orderBy('nft.created_at', 'DESC').skip(skip).take(limit);

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

  async findOne(id: string): Promise<NftCatalog> {
    const nft = await this.nftRepository.findOne({
      where: {
        id,
        is_active: true,
        status: NftCatalogStatus.PUBLISHED,
      },
      relations: ['prot'],
    });

    if (!nft) {
      throw new NotFoundException(`NFT dengan id '${id}' tidak ditemukan`);
    }

    return nft;
  }

  async findBySlug(slug: string): Promise<NftCatalog> {
    const nft = await this.nftRepository.findOne({
      where: {
        slug,
        is_active: true,
        status: NftCatalogStatus.PUBLISHED,
      },
      relations: ['prot'],
    });

    if (!nft) {
      throw new NotFoundException(`NFT dengan slug '${slug}' tidak ditemukan`);
    }

    return nft;
  }

  async update(id: string, userId: string, dto: UpdateNftDto): Promise<NftCatalog> {
    const nft = await this.findActiveById(id);

    await this.validateProt(dto.prot_id);

    if (dto.slug && dto.slug !== nft.slug) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    const identityChanged =
      dto.blockchain_network !== undefined ||
      dto.contract_address !== undefined ||
      dto.token_id !== undefined;

    if (identityChanged) {
      await this.assertBlockchainIdentityAvailable(
        dto.blockchain_network ?? nft.blockchain_network,
        dto.contract_address ?? nft.contract_address,
        dto.token_id ?? nft.token_id,
        id,
      );
    }

    Object.assign(nft, dto, { updated_by: userId });
    return this.nftRepository.save(nft);
  }

  async publish(id: string, userId: string): Promise<NftCatalog> {
    const nft = await this.findActiveById(id);
    nft.status = NftCatalogStatus.PUBLISHED;
    nft.published_at = new Date();
    nft.updated_by = userId;
    return this.nftRepository.save(nft);
  }

  async unpublish(id: string, userId: string): Promise<NftCatalog> {
    const nft = await this.findActiveById(id);
    nft.status = NftCatalogStatus.DRAFT;
    nft.published_at = null;
    nft.updated_by = userId;
    return this.nftRepository.save(nft);
  }

  async remove(id: string, userId: string): Promise<void> {
    const nft = await this.findActiveById(id);
    nft.is_active = false;
    nft.updated_by = userId;
    await this.nftRepository.save(nft);
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string; message: string }> {
    const url = await this.storageService.uploadFile(file, 'images/nfts');
    return {
      url,
      message: 'NFT image uploaded successfully',
    };
  }

  private async findActiveById(id: string): Promise<NftCatalog> {
    const nft = await this.nftRepository.findOne({
      where: { id, is_active: true },
      relations: ['prot'],
    });

    if (!nft) {
      throw new NotFoundException(`NFT dengan id '${id}' tidak ditemukan`);
    }

    return nft;
  }

  private async validateProt(protId?: string): Promise<void> {
    if (!protId) {
      return;
    }

    const prot = await this.protRepository.findOne({ where: { id: protId } });
    if (!prot) {
      throw new BadRequestException(`Invalid prot_id: ${protId}`);
    }
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.nftRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug '${slug}' sudah digunakan`);
    }
  }

  private async assertBlockchainIdentityAvailable(
    blockchainNetwork: string,
    contractAddress: string,
    tokenId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.nftRepository.findOne({
      where: {
        blockchain_network: blockchainNetwork,
        contract_address: contractAddress,
        token_id: tokenId,
      },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'NFT dengan blockchain_network, contract_address, dan token_id tersebut sudah ada',
      );
    }
  }
}
