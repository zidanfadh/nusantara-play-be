import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PROT } from '../../prot/entities/prot.entity';
import { StorageService } from '../../storage/storage.service';
import { CreateNftDto } from '../dto/create-nft.dto';
import { NftCatalog, NftCatalogStatus } from '../entities/nft-catalog.entity';
import { NftsService } from '../nfts.service';

const mockNftRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockProtRepository = {
  findOne: jest.fn(),
};

const mockStorageService = {
  uploadFile: jest.fn(),
};

const baseDto: CreateNftDto = {
  nama: 'Gasing Heritage NFT',
  slug: 'gasing-heritage-nft',
  deskripsi: 'NFT katalog permainan rakyat',
  about: 'Tentang koleksi NFT Gasing',
  image_url: 'https://example.com/gasing.png',
  gallery_urls: ['https://example.com/gasing-1.png'],
  blockchain_network: 'ethereum',
  contract_address: '0x123',
  token_id: '1',
  token_standard: 'ERC721',
  marketplace_name: 'OpenSea',
  marketplace_url: 'https://opensea.io/assets/ethereum/0x123/1',
};

describe('NftsService', () => {
  let service: NftsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NftsService,
        { provide: getRepositoryToken(NftCatalog), useValue: mockNftRepository },
        { provide: getRepositoryToken(PROT), useValue: mockProtRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<NftsService>(NftsService);
    jest.clearAllMocks();
    mockNftRepository.save.mockImplementation(async (entity) => entity);
  });

  describe('create', () => {
    it('creates a draft NFT with created_by', async () => {
      const nft = {
        id: 'nft-1',
        ...baseDto,
        status: NftCatalogStatus.DRAFT,
        is_active: true,
        created_by: 'admin-1',
        updated_by: 'admin-1',
        published_at: null,
      };

      mockNftRepository.findOne.mockResolvedValue(null);
      mockNftRepository.create.mockReturnValue(nft);

      const result = await service.create('admin-1', baseDto);

      expect(result.status).toBe(NftCatalogStatus.DRAFT);
      expect(result.created_by).toBe('admin-1');
      expect(mockNftRepository.create).toHaveBeenCalledWith({
        ...baseDto,
        status: NftCatalogStatus.DRAFT,
        is_active: true,
        created_by: 'admin-1',
        updated_by: 'admin-1',
        published_at: null,
      });
    });

    it('rejects duplicate slug', async () => {
      mockNftRepository.findOne.mockResolvedValueOnce({ id: 'existing-nft' });

      await expect(service.create('admin-1', baseDto)).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate blockchain identity', async () => {
      mockNftRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-nft' });

      await expect(service.create('admin-1', baseDto)).rejects.toThrow(ConflictException);
    });

    it('validates optional prot_id', async () => {
      mockProtRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('admin-1', { ...baseDto, prot_id: '550e8400-e29b-41d4-a716-446655440000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns only published and active NFTs for public listing', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'nft-1' }], 1]),
      };

      mockNftRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(queryBuilder.where).toHaveBeenCalledWith('nft.is_active = true');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('nft.status = :status', {
        status: NftCatalogStatus.PUBLISHED,
      });
    });
  });

  describe('update', () => {
    it('updates NFT fields and replaces gallery_urls', async () => {
      const nft = {
        id: 'nft-1',
        slug: baseDto.slug,
        blockchain_network: baseDto.blockchain_network,
        contract_address: baseDto.contract_address,
        token_id: baseDto.token_id,
        gallery_urls: ['https://example.com/old.png'],
        is_active: true,
      };

      mockNftRepository.findOne.mockResolvedValue(nft);

      const result = await service.update('nft-1', 'admin-1', {
        gallery_urls: ['https://example.com/new.png'],
      });

      expect(result.gallery_urls).toEqual(['https://example.com/new.png']);
      expect(result.updated_by).toBe('admin-1');
    });
  });

  describe('publish and unpublish', () => {
    it('publishes NFT', async () => {
      const nft = { id: 'nft-1', is_active: true, status: NftCatalogStatus.DRAFT };
      mockNftRepository.findOne.mockResolvedValue(nft);

      const result = await service.publish('nft-1', 'admin-1');

      expect(result.status).toBe(NftCatalogStatus.PUBLISHED);
      expect(result.published_at).toBeInstanceOf(Date);
      expect(result.updated_by).toBe('admin-1');
    });

    it('unpublishes NFT and clears published_at', async () => {
      const nft = {
        id: 'nft-1',
        is_active: true,
        status: NftCatalogStatus.PUBLISHED,
        published_at: new Date(),
      };
      mockNftRepository.findOne.mockResolvedValue(nft);

      const result = await service.unpublish('nft-1', 'admin-1');

      expect(result.status).toBe(NftCatalogStatus.DRAFT);
      expect(result.published_at).toBeNull();
      expect(result.updated_by).toBe('admin-1');
    });
  });

  describe('remove', () => {
    it('soft deletes NFT', async () => {
      const nft = { id: 'nft-1', is_active: true };
      mockNftRepository.findOne.mockResolvedValue(nft);

      await service.remove('nft-1', 'admin-1');

      expect(nft.is_active).toBe(false);
      expect(nft.updated_by).toBe('admin-1');
      expect(mockNftRepository.save).toHaveBeenCalledWith(nft);
    });

    it('throws NotFoundException for inactive or missing NFT', async () => {
      mockNftRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing-nft', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
});
