import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerifikasiService } from './verifikasi.service';
import { Verifikasi, VerifikasiStatus } from './entities/verifikasi.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { PROT, PROTStatus } from './entities/prot.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { DaerahService } from '../daerah/daerah.service';
import { DaerahLevel } from '../daerah/entities/daerah.entity';
import { UserRole } from '../users/entities/user.entity';

describe('VerifikasiService', () => {
  let service: VerifikasiService;
  let verifikasiRepository: Repository<Verifikasi>;
  let queueRepository: Repository<VerifikasiQueue>;
  let protRepository: Repository<PROT>;

  const mockVerifikasiRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueueRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockProtRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBlockchainService = {
    anchorVerification: jest.fn().mockResolvedValue(undefined),
  };

  const mockDaerahService = {
    findAncestors: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifikasiService,
        {
          provide: getRepositoryToken(Verifikasi),
          useValue: mockVerifikasiRepository,
        },
        {
          provide: getRepositoryToken(VerifikasiQueue),
          useValue: mockQueueRepository,
        },
        {
          provide: getRepositoryToken(PROT),
          useValue: mockProtRepository,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: DaerahService,
          useValue: mockDaerahService,
        },
      ],
    }).compile();

    service = module.get<VerifikasiService>(VerifikasiService);
    verifikasiRepository = module.get<Repository<Verifikasi>>(getRepositoryToken(Verifikasi));
    queueRepository = module.get<Repository<VerifikasiQueue>>(getRepositoryToken(VerifikasiQueue));
    protRepository = module.get<Repository<PROT>>(getRepositoryToken(PROT));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableQueue', () => {
    it('should return paginated available queue items', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          prot: { id: 'prot-1', nama: 'Gasing', status: PROTStatus.DIKURASI },
          priority: 0,
          created_at: new Date(),
        },
      ];

      mockQueueRepository.findAndCount.mockResolvedValue([mockQueue, 1]);

      const result = await service.getAvailableQueue(1, 20);

      expect(result.data).toEqual(mockQueue);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(queueRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['prot', 'prot.createdBy'],
          order: { priority: 'DESC', created_at: 'ASC' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter available queue by kurator province', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          prot: {
            id: 'prot-1',
            nama: 'Gasing',
            status: PROTStatus.DIKURASI,
            provinsiKode: '32',
          },
          priority: 0,
          created_at: new Date(),
        },
      ];

      mockDaerahService.findAncestors.mockResolvedValue([
        {
          id: 'province-1',
          kode: '32',
          level: DaerahLevel.PROVINSI,
        },
        {
          id: 'city-1',
          kode: '32.73',
          level: DaerahLevel.KOTA,
        },
      ]);
      mockQueueRepository.findAndCount.mockResolvedValue([mockQueue, 1]);

      const result = await service.getAvailableQueue(1, 20, {
        id: 'kurator-1',
        role: UserRole.KURATOR_DAERAH,
        daerah_id: 'city-1',
      });

      expect(result.data).toEqual(mockQueue);
      expect(mockDaerahService.findAncestors).toHaveBeenCalledWith('city-1');
      expect(queueRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assigned_pakar_id: expect.anything(),
            prot: { provinsiKode: '32' },
          },
        }),
      );
    });

    it('should filter available queue by requested province for pakar and admin', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          prot: {
            id: 'prot-1',
            nama: 'Gasing',
            status: PROTStatus.DIKURASI,
            provinsiKode: '32',
          },
          priority: 0,
          created_at: new Date(),
        },
      ];

      mockQueueRepository.findAndCount.mockResolvedValue([mockQueue, 1]);

      const result = await service.getAvailableQueue(
        1,
        20,
        { role: UserRole.PAKAR },
        '32',
      );

      expect(result.data).toEqual(mockQueue);
      expect(mockDaerahService.findAncestors).not.toHaveBeenCalled();
      expect(queueRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assigned_pakar_id: expect.anything(),
            prot: { provinsiKode: '32' },
          },
        }),
      );
    });
  });

  describe('pickFromQueue', () => {
    it('should successfully pick a PROT from queue', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot: { id: 'prot-1', status: PROTStatus.DIKURASI },
        assigned_pakar_id: null,
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockQueueRepository.save.mockResolvedValue({
        ...mockQueue,
        assigned_pakar_id: 'pakar-1',
        assigned_at: expect.any(Date),
      });

      const result = await service.pickFromQueue('queue-1', 'pakar-1');

      expect(result.assigned_pakar_id).toBe('pakar-1');
      expect(result.assigned_at).toBeDefined();
    });

    it('should throw NotFoundException if queue item not found', async () => {
      mockQueueRepository.findOne.mockResolvedValue(null);

      await expect(service.pickFromQueue('queue-1', 'pakar-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already assigned', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot: { id: 'prot-1', status: PROTStatus.DIKURASI },
        assigned_pakar_id: 'pakar-2',
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);

      await expect(service.pickFromQueue('queue-1', 'pakar-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow kurator daerah to pick a PROT from their province', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot: {
          id: 'prot-1',
          status: PROTStatus.DIKURASI,
          provinsiKode: '32',
        },
        assigned_pakar_id: null,
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockDaerahService.findAncestors.mockResolvedValue([
        { id: 'province-1', kode: '32', level: DaerahLevel.PROVINSI },
        { id: 'city-1', kode: '32.73', level: DaerahLevel.KOTA },
      ]);
      mockQueueRepository.save.mockResolvedValue({
        ...mockQueue,
        assigned_pakar_id: 'kurator-1',
        assigned_at: expect.any(Date),
      });

      const result = await service.pickFromQueue('queue-1', 'kurator-1', {
        role: UserRole.KURATOR_DAERAH,
        daerah_id: 'city-1',
      });

      expect(result.assigned_pakar_id).toBe('kurator-1');
      expect(mockDaerahService.findAncestors).toHaveBeenCalledWith('city-1');
    });

    it('should reject kurator daerah picking a PROT from another province', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot: {
          id: 'prot-1',
          status: PROTStatus.DIKURASI,
          provinsiKode: '33',
        },
        assigned_pakar_id: null,
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockDaerahService.findAncestors.mockResolvedValue([
        { id: 'province-1', kode: '32', level: DaerahLevel.PROVINSI },
        { id: 'city-1', kode: '32.73', level: DaerahLevel.KOTA },
      ]);

      await expect(
        service.pickFromQueue('queue-1', 'kurator-1', {
          role: UserRole.KURATOR_DAERAH,
          daerah_id: 'city-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockQueueRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('submitReview', () => {
    const mockReviewDto = {
      status: VerifikasiStatus.APPROVED,
      catatan: 'Good documentation',
    };

    it('should submit APPROVED review successfully', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot_id: 'prot-1',
        prot: { id: 'prot-1', status: PROTStatus.DIKURASI },
      };

      const mockVerifikasi = {
        id: 'verif-1',
        prot_id: 'prot-1',
        pakar_id: 'pakar-1',
        status: VerifikasiStatus.APPROVED,
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockVerifikasiRepository.create.mockReturnValue(mockVerifikasi);
      mockVerifikasiRepository.save.mockResolvedValue(mockVerifikasi);
      mockProtRepository.save.mockResolvedValue({
        ...mockQueue.prot,
        status: PROTStatus.DIVERIFIKASI,
        verified_by: 'pakar-1',
        verified_at: expect.any(Date),
      });
      mockQueueRepository.remove.mockResolvedValue(mockQueue);

      const result = await service.submitReview('prot-1', 'pakar-1', mockReviewDto);

      expect(result.status).toBe(VerifikasiStatus.APPROVED);
      expect(protRepository.save).toHaveBeenCalled();
    });

    it('should submit REVISION_NEEDED review successfully', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot_id: 'prot-1',
        prot: { id: 'prot-1', status: PROTStatus.DIKURASI },
      };

      const reviewDto = {
        status: VerifikasiStatus.REVISION_NEEDED,
        catatan: 'Needs improvement',
        saran_perbaikan: 'Add more details',
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockVerifikasiRepository.create.mockReturnValue({});
      mockVerifikasiRepository.save.mockResolvedValue({});
      mockProtRepository.save.mockResolvedValue({
        ...mockQueue.prot,
        status: PROTStatus.REVISI,
      });
      mockQueueRepository.remove.mockResolvedValue(mockQueue);

      const result = await service.submitReview('prot-1', 'pakar-1', reviewDto);

      expect(result).toBeDefined();
      expect(protRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if PROT not assigned to pakar', async () => {
      mockQueueRepository.findOne.mockResolvedValue(null);

      await expect(
        service.submitReview('prot-1', 'pakar-1', mockReviewDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow kurator daerah to submit review for their province', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot_id: 'prot-1',
        prot: {
          id: 'prot-1',
          status: PROTStatus.DIKURASI,
          provinsiKode: '32',
        },
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockDaerahService.findAncestors.mockResolvedValue([
        { id: 'province-1', kode: '32', level: DaerahLevel.PROVINSI },
        { id: 'city-1', kode: '32.73', level: DaerahLevel.KOTA },
      ]);
      mockVerifikasiRepository.create.mockReturnValue({
        id: 'verif-1',
        status: VerifikasiStatus.APPROVED,
      });
      mockVerifikasiRepository.save.mockResolvedValue({
        id: 'verif-1',
        status: VerifikasiStatus.APPROVED,
      });
      mockProtRepository.save.mockResolvedValue({
        ...mockQueue.prot,
        status: PROTStatus.DIVERIFIKASI,
      });
      mockQueueRepository.remove.mockResolvedValue(mockQueue);

      const result = await service.submitReview(
        'prot-1',
        'kurator-1',
        mockReviewDto,
        {
          role: UserRole.KURATOR_DAERAH,
          daerah_id: 'city-1',
        },
      );

      expect(result.status).toBe(VerifikasiStatus.APPROVED);
      expect(mockDaerahService.findAncestors).toHaveBeenCalledWith('city-1');
      expect(protRepository.save).toHaveBeenCalled();
    });

    it('should reject kurator daerah submitting review for another province', async () => {
      const mockQueue = {
        id: 'queue-1',
        prot_id: 'prot-1',
        prot: {
          id: 'prot-1',
          status: PROTStatus.DIKURASI,
          provinsiKode: '33',
        },
      };

      mockQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockDaerahService.findAncestors.mockResolvedValue([
        { id: 'province-1', kode: '32', level: DaerahLevel.PROVINSI },
        { id: 'city-1', kode: '32.73', level: DaerahLevel.KOTA },
      ]);

      await expect(
        service.submitReview('prot-1', 'kurator-1', mockReviewDto, {
          role: UserRole.KURATOR_DAERAH,
          daerah_id: 'city-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockVerifikasiRepository.create).not.toHaveBeenCalled();
      expect(protRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getVerifikasiHistory', () => {
    it('should return verification history for a PROT', async () => {
      const mockHistory = [
        {
          id: 'verif-1',
          prot_id: 'prot-1',
          status: VerifikasiStatus.APPROVED,
          pakar: { id: 'pakar-1', full_name: 'Pakar 1' },
        },
      ];

      mockVerifikasiRepository.find.mockResolvedValue(mockHistory);

      const result = await service.getVerifikasiHistory('prot-1');

      expect(result).toEqual(mockHistory);
      expect(verifikasiRepository.find).toHaveBeenCalledWith({
        where: { prot_id: 'prot-1' },
        relations: ['pakar'],
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('getVerifikasiStats', () => {
    it('should return verification statistics', async () => {
      mockQueueRepository.count.mockResolvedValue(5);
      mockVerifikasiRepository.count.mockResolvedValue(10);
      mockProtRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'DRAFT', count: '3' },
          { status: 'ARSIP_NASIONAL', count: '15' },
        ]),
      });

      const result = await service.getVerifikasiStats();

      expect(result.queue.totalPending).toBe(5);
      expect(result.verifikasi.totalApproved).toBeDefined();
      expect(result.protByStatus).toBeDefined();
    });
  });
});
