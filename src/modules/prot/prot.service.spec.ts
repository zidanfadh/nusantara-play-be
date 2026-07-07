import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROTService } from './prot.service';
import { PROT, PROTStatus, PROTJenis, TargetUsia } from './entities/prot.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { DaerahService } from '../daerah/daerah.service';
import { StorageService } from '../storage/storage.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';

describe('PROTService', () => {
  let service: PROTService;
  let protRepository: Repository<PROT>;
  let queueRepository: Repository<VerifikasiQueue>;

  const mockProtRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueueRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDaerahService = {
    findByKode: jest.fn(),
    findAncestors: jest.fn(),
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PROTService,
        {
          provide: getRepositoryToken(PROT),
          useValue: mockProtRepository,
        },
        {
          provide: getRepositoryToken(VerifikasiQueue),
          useValue: mockQueueRepository,
        },
        {
          provide: DaerahService,
          useValue: mockDaerahService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<PROTService>(PROTService);
    protRepository = module.get<Repository<PROT>>(getRepositoryToken(PROT));
    queueRepository = module.get<Repository<VerifikasiQueue>>(getRepositoryToken(VerifikasiQueue));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create PROT with DRAFT status and created_by', async () => {
      const createDto = {
        nama: 'Gasing',
        jenis: PROTJenis.PERMAINAN_RAKYAT,
        provinsiKode: '11',
        kabkotaKode: '11.01',
        targetUsia: TargetUsia.ANAK,
      };

      const mockUser = { id: 'user-1', role: UserRole.KURATOR_DAERAH } as any;
      const mockProt = { id: 'prot-1', ...createDto, status: PROTStatus.DRAFT, created_by: 'user-1' };

      mockDaerahService.findByKode.mockResolvedValue({});
      mockProtRepository.create.mockReturnValue(mockProt);
      mockProtRepository.save.mockResolvedValue(mockProt);

      const result = await service.create(createDto, mockUser);

      expect(result.status).toBe(PROTStatus.DRAFT);
      expect(result.created_by).toBe('user-1');
      expect(mockProtRepository.create).toHaveBeenCalledWith({
        ...createDto,
        created_by: 'user-1',
        status: PROTStatus.DRAFT,
      });
    });

    it('should allow pakar to create PROT in their province', async () => {
      const createDto = {
        nama: 'Gasing',
        jenis: PROTJenis.PERMAINAN_RAKYAT,
        provinsiKode: '11',
        kabkotaKode: '11.01',
        targetUsia: TargetUsia.ANAK,
      };

      const mockUser = {
        id: 'user-1',
        role: UserRole.PAKAR,
        daerah_id: 'daerah-1',
      } as any;

      const mockProt = { id: 'prot-1', ...createDto, status: PROTStatus.DRAFT, created_by: 'user-1' };

      mockDaerahService.findByKode.mockResolvedValue({});
      mockDaerahService.findAncestors.mockResolvedValue([
        { kode: '11', nama: 'Aceh' },
      ]);
      mockProtRepository.create.mockReturnValue(mockProt);
      mockProtRepository.save.mockResolvedValue(mockProt);

      const result = await service.create(createDto, mockUser);

      expect(result.status).toBe(PROTStatus.DRAFT);
    });

    it('should reject pakar if PROT province differs from their own', async () => {
      const createDto = {
        nama: 'Gasing',
        jenis: PROTJenis.PERMAINAN_RAKYAT,
        provinsiKode: '12', // Different province
        kabkotaKode: '12.01',
        targetUsia: TargetUsia.ANAK,
      };

      const mockUser = {
        id: 'user-1',
        role: UserRole.PAKAR,
        daerah_id: 'daerah-1',
      } as any;

      mockDaerahService.findByKode.mockResolvedValue({});
      mockDaerahService.findAncestors.mockResolvedValue([
        { kode: '11', nama: 'Aceh' },
      ]);

      await expect(service.create(createDto, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should reject pakar without daerah_id', async () => {
      const createDto = {
        nama: 'Gasing',
        jenis: PROTJenis.PERMAINAN_RAKYAT,
        provinsiKode: '11',
        targetUsia: TargetUsia.ANAK,
      };

      const mockUser = {
        id: 'user-1',
        role: UserRole.PAKAR,
        daerah_id: null,
      } as any;

      mockDaerahService.findByKode.mockResolvedValue({});

      await expect(service.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitKurasi', () => {
    it('should submit PROT for verification successfully', async () => {
      const mockProt = {
        id: 'prot-1',
        nama: 'Gasing',
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);
      mockProtRepository.save.mockResolvedValue({
        ...mockProt,
        status: PROTStatus.DIKURASI,
        submitted_at: expect.any(Date),
      });
      mockQueueRepository.create.mockReturnValue({ prot_id: 'prot-1', priority: 0 });
      mockQueueRepository.save.mockResolvedValue({});

      const result = await service.submitKurasi('prot-1', 'user-1');

      expect(result.status).toBe(PROTStatus.DIKURASI);
      expect(result.submitted_at).toBeDefined();
      expect(mockQueueRepository.create).toHaveBeenCalledWith({
        prot_id: 'prot-1',
        priority: 0,
      });
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-2',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(service.submitKurasi('prot-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if status is not DRAFT', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DIKURASI,
        created_by: 'user-1',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(service.submitKurasi('prot-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resubmitAfterRevisi', () => {
    it('should resubmit PROT after revision', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.REVISI,
        created_by: 'user-1',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);
      mockProtRepository.save.mockResolvedValue({
        ...mockProt,
        status: PROTStatus.DIKURASI,
        submitted_at: expect.any(Date),
      });
      mockQueueRepository.create.mockReturnValue({ prot_id: 'prot-1', priority: 0 });
      mockQueueRepository.save.mockResolvedValue({});

      const result = await service.resubmitAfterRevisi('prot-1', 'user-1');

      expect(result.status).toBe(PROTStatus.DIKURASI);
    });

    it('should throw BadRequestException if status is not REVISI', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(service.resubmitAfterRevisi('prot-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('publishToArsipNasional', () => {
    it('should publish PROT to national archive', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DIVERIFIKASI,
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);
      mockProtRepository.save.mockResolvedValue({
        ...mockProt,
        status: PROTStatus.ARSIP_NASIONAL,
        published_by: 'admin-1',
        published_at: expect.any(Date),
      });

      const result = await service.publishToArsipNasional('prot-1', 'admin-1');

      expect(result.status).toBe(PROTStatus.ARSIP_NASIONAL);
      expect(result.published_by).toBe('admin-1');
    });

    it('should throw BadRequestException if status is not DIVERIFIKASI', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DIKURASI,
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(service.publishToArsipNasional('prot-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update with ownership check', () => {
    it('should allow admin to update any PROT', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-2',
      };

      const updateDto = { nama: 'Updated Name' };

      mockProtRepository.findOne.mockResolvedValue(mockProt);
      mockDaerahService.findByKode.mockResolvedValue({});
      mockProtRepository.save.mockResolvedValue({ ...mockProt, ...updateDto });

      const result = await service.update('prot-1', updateDto, 'admin-1', UserRole.ADMIN_KPOTI);

      expect(result).toBeDefined();
    });

    it('should allow kurator to update own PROT', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      };

      const updateDto = { nama: 'Updated Name' };

      mockProtRepository.findOne.mockResolvedValue(mockProt);
      mockDaerahService.findByKode.mockResolvedValue({});
      mockProtRepository.save.mockResolvedValue({ ...mockProt, ...updateDto });

      const result = await service.update('prot-1', updateDto, 'user-1', UserRole.KURATOR_DAERAH);

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if kurator tries to update other PROT', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-2',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(
        service.update('prot-1', {}, 'user-1', UserRole.KURATOR_DAERAH),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if PROT cannot be edited', async () => {
      const mockProt = {
        id: 'prot-1',
        status: PROTStatus.DIVERIFIKASI,
        created_by: 'user-1',
      };

      mockProtRepository.findOne.mockResolvedValue(mockProt);

      await expect(
        service.update('prot-1', {}, 'user-1', UserRole.KURATOR_DAERAH),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll with role-based filtering', () => {
    it('should return only ARSIP_NASIONAL for public users', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'prot-1' }], 1]),
      };

      mockProtRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findAll({ page: 1, limit: 10 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'prot.status = :roleStatus',
        { roleStatus: PROTStatus.ARSIP_NASIONAL },
      );
    });
  });

  describe('findOneForRead', () => {
    it('allows guest users to read ARSIP_NASIONAL PROT detail', async () => {
      const prot = {
        id: 'published-id',
        nama: 'Gasing',
        status: PROTStatus.ARSIP_NASIONAL,
      };
      mockProtRepository.findOne.mockResolvedValue(prot);

      const result = await service.findOneForRead('published-id');

      expect(result.id).toBe('published-id');
    });

    it('hides draft PROT detail from guest users', async () => {
      const prot = {
        id: 'draft-id',
        nama: 'Gasing',
        status: PROTStatus.DRAFT,
      };
      mockProtRepository.findOne.mockResolvedValue(prot);

      await expect(service.findOneForRead('draft-id')).rejects.toThrow(NotFoundException);
    });

    it('allows kurator to read own draft PROT detail', async () => {
      const user = {
        id: 'user-1',
        role: UserRole.KURATOR_DAERAH,
      } as any;
      const prot = {
        id: 'own-draft-id',
        nama: 'Gasing',
        status: PROTStatus.DRAFT,
        created_by: user.id,
      };
      mockProtRepository.findOne.mockResolvedValue(prot);

      const result = await service.findOneForRead('own-draft-id', user);

      expect(result.id).toBe('own-draft-id');
    });

    it('forbids kurator from reading another user draft PROT detail', async () => {
      const user = {
        id: 'user-1',
        role: UserRole.KURATOR_DAERAH,
      } as any;
      const prot = {
        id: 'other-draft-id',
        nama: 'Gasing',
        status: PROTStatus.DRAFT,
        created_by: 'other-user-id',
      };
      mockProtRepository.findOne.mockResolvedValue(prot);

      await expect(service.findOneForRead('other-draft-id', user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
