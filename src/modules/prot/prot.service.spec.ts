import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROTService } from './prot.service';
import {
  PROT,
  PROTStatus,
  PROTJenis,
  TargetUsia,
} from './entities/prot.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { DaerahService } from '../daerah/daerah.service';
import { StorageService } from '../storage/storage.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { User, UserRole } from '../users/entities/user.entity';

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
    queueRepository = module.get<Repository<VerifikasiQueue>>(
      getRepositoryToken(VerifikasiQueue),
    );
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
      const mockProt = {
        id: 'prot-1',
        ...createDto,
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      };

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

      const mockProt = {
        id: 'prot-1',
        ...createDto,
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      };

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

      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
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

      await expect(service.create(createDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
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
      mockQueueRepository.create.mockReturnValue({
        prot_id: 'prot-1',
        priority: 0,
      });
      mockQueueRepository.save.mockResolvedValue({});

      const result = await service.submitKurasi('prot-1', 'user-1');

      expect(result.status).toBe(PROTStatus.DIKURASI);
      expect(result.submitted_at).toBeDefined();
      // B7: no catatan -> the queue entry gets catatan_kurator null.
      expect(mockQueueRepository.create).toHaveBeenCalledWith({
        prot_id: 'prot-1',
        priority: 0,
        catatan_kurator: null,
      });
    });

    it('stores the submission note (catatan) on the queue entry (B7)', async () => {
      mockProtRepository.findOne.mockResolvedValue({
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      });
      mockProtRepository.save.mockImplementation((p: PROT) =>
        Promise.resolve(p),
      );
      mockQueueRepository.create.mockImplementation(
        (q: Partial<VerifikasiQueue>) => q,
      );
      mockQueueRepository.save.mockImplementation(
        (q: Partial<VerifikasiQueue>) => Promise.resolve(q),
      );

      await service.submitKurasi(
        'prot-1',
        'user-1',
        '  Mohon cek bagian cara bermain.  ',
      );

      expect(mockQueueRepository.create).toHaveBeenCalledWith({
        prot_id: 'prot-1',
        priority: 0,
        catatan_kurator: 'Mohon cek bagian cara bermain.',
      });
    });

    it('stores null when catatan is only whitespace (B7)', async () => {
      mockProtRepository.findOne.mockResolvedValue({
        id: 'prot-1',
        status: PROTStatus.DRAFT,
        created_by: 'user-1',
      });
      mockProtRepository.save.mockImplementation((p: PROT) =>
        Promise.resolve(p),
      );
      mockQueueRepository.create.mockImplementation(
        (q: Partial<VerifikasiQueue>) => q,
      );
      mockQueueRepository.save.mockResolvedValue({});

      await service.submitKurasi('prot-1', 'user-1', '   ');

      expect(mockQueueRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ catatan_kurator: null }),
      );
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
      mockQueueRepository.create.mockReturnValue({
        prot_id: 'prot-1',
        priority: 0,
      });
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

      await expect(
        service.resubmitAfterRevisi('prot-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
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

      await expect(
        service.publishToArsipNasional('prot-1', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
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

      const result = await service.update(
        'prot-1',
        updateDto,
        'admin-1',
        UserRole.ADMIN_KPOTI,
      );

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

      const result = await service.update(
        'prot-1',
        updateDto,
        'user-1',
        UserRole.KURATOR_DAERAH,
      );

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

    it('does not log the user email or id (P2)', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockProtRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      try {
        await service.findAll({ page: 1, limit: 10 }, {
          id: 'user-secret-id',
          role: UserRole.KURATOR_DAERAH,
          email: 'someone@example.test',
        } as User);

        const printed = [
          ...(consoleSpy.mock.calls.flat() as unknown[]),
          ...stdoutSpy.mock.calls.map((c) => String(c[0])),
        ]
          .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
          .join('\n');
        expect(printed).not.toContain('someone@example.test');
        expect(printed).not.toContain('user-secret-id');
      } finally {
        consoleSpy.mockRestore();
        stdoutSpy.mockRestore();
      }
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

      await expect(service.findOneForRead('draft-id')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(
        service.findOneForRead('other-draft-id', user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('media routes: ownership and status (B1)', () => {
    const owner = { id: 'owner-1', role: UserRole.KURATOR_DAERAH } as User;
    const otherKurator = {
      id: 'kurator-2',
      role: UserRole.KURATOR_DAERAH,
    } as User;
    const admin = { id: 'admin-1', role: UserRole.ADMIN_KPOTI } as User;
    const files = [{ originalname: 'a.jpg' }] as Express.Multer.File[];

    const buildProt = (status: PROTStatus) => ({
      id: 'prot-1',
      nama: 'Gasing',
      status,
      created_by: 'owner-1',
      fotoKegiatan: ['https://bucket/foto-1.jpg'],
      videoKegiatan: ['https://bucket/video-1.mp4'],
      dokumenKurikulum: ['https://bucket/dok-1.pdf'],
      peralatan: [{ nama: 'Gasing', fotoAlat: ['https://bucket/alat-1.jpg'] }],
    });

    type MediaCall = {
      name: string;
      kind: 'add' | 'remove';
      call: (user: User) => Promise<PROT>;
    };

    const mediaCalls: MediaCall[] = [
      {
        name: 'addFotoKegiatan',
        kind: 'add',
        call: (user) => service.addFotoKegiatan('prot-1', files, user),
      },
      {
        name: 'addVideoKegiatan',
        kind: 'add',
        call: (user) => service.addVideoKegiatan('prot-1', files, user),
      },
      {
        name: 'addDokumenKurikulum',
        kind: 'add',
        call: (user) => service.addDokumenKurikulum('prot-1', files, user),
      },
      {
        name: 'addFotoAlat',
        kind: 'add',
        call: (user) => service.addFotoAlat('prot-1', 0, files, user),
      },
      {
        name: 'removeFotoKegiatan',
        kind: 'remove',
        call: (user) => service.removeFotoKegiatan('prot-1', 0, user),
      },
      {
        name: 'removeVideoKegiatan',
        kind: 'remove',
        call: (user) => service.removeVideoKegiatan('prot-1', 0, user),
      },
      {
        name: 'removeDokumenKurikulum',
        kind: 'remove',
        call: (user) => service.removeDokumenKurikulum('prot-1', 0, user),
      },
      {
        name: 'removeFotoAlat',
        kind: 'remove',
        call: (user) => service.removeFotoAlat('prot-1', 0, 0, user),
      },
    ];

    beforeEach(() => {
      mockStorageService.uploadFile.mockResolvedValue(
        'https://bucket/new-file',
      );
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockProtRepository.save.mockImplementation((prot: PROT) =>
        Promise.resolve(prot),
      );
    });

    describe.each(mediaCalls)('$name', ({ kind, call }) => {
      const storageCall = () =>
        kind === 'add'
          ? mockStorageService.uploadFile
          : mockStorageService.deleteFile;

      it.each([PROTStatus.DRAFT, PROTStatus.REVISI])(
        'allows the owner when status is %s',
        async (status) => {
          mockProtRepository.findOne.mockResolvedValue(buildProt(status));

          await expect(call(owner)).resolves.toBeDefined();
          expect(storageCall()).toHaveBeenCalledTimes(1);
          expect(mockProtRepository.save).toHaveBeenCalledTimes(1);
        },
      );

      it('allows admin_kpoti on another user PROT', async () => {
        mockProtRepository.findOne.mockResolvedValue(
          buildProt(PROTStatus.DRAFT),
        );

        await expect(call(admin)).resolves.toBeDefined();
        expect(storageCall()).toHaveBeenCalledTimes(1);
      });

      it('returns 403 for another kurator and never touches storage', async () => {
        mockProtRepository.findOne.mockResolvedValue(
          buildProt(PROTStatus.DRAFT),
        );

        await expect(call(otherKurator)).rejects.toThrow(
          new ForbiddenException(
            'Anda tidak memiliki akses untuk edit PROT ini',
          ),
        );
        expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
        expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
        expect(mockProtRepository.save).not.toHaveBeenCalled();
      });

      it.each([
        PROTStatus.DIKURASI,
        PROTStatus.DIVERIFIKASI,
        PROTStatus.ARSIP_NASIONAL,
      ])(
        'returns 400 for the owner when status is %s and never touches storage',
        async (status) => {
          mockProtRepository.findOne.mockResolvedValue(buildProt(status));

          await expect(call(owner)).rejects.toThrow(
            new BadRequestException(
              `PROT dengan status ${status} tidak bisa diedit`,
            ),
          );
          expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
          expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
          expect(mockProtRepository.save).not.toHaveBeenCalled();
        },
      );

      it('returns 400 for admin_kpoti when status is ARSIP_NASIONAL', async () => {
        mockProtRepository.findOne.mockResolvedValue(
          buildProt(PROTStatus.ARSIP_NASIONAL),
        );

        await expect(call(admin)).rejects.toThrow(BadRequestException);
        expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
        expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      });
    });

    describe.each(mediaCalls.filter((c) => c.kind === 'remove'))(
      '$name (remove order)',
      ({ call }) => {
        it('saves the database before deleting the S3 object', async () => {
          mockProtRepository.findOne.mockResolvedValue(
            buildProt(PROTStatus.DRAFT),
          );

          await expect(call(owner)).resolves.toBeDefined();

          const saveOrder = mockProtRepository.save.mock.invocationCallOrder[0];
          const deleteOrder =
            mockStorageService.deleteFile.mock.invocationCallOrder[0];
          expect(saveOrder).toBeLessThan(deleteOrder);
        });

        it('does not delete the S3 object when the save fails', async () => {
          mockProtRepository.findOne.mockResolvedValue(
            buildProt(PROTStatus.DRAFT),
          );
          mockProtRepository.save.mockRejectedValueOnce(new Error('db down'));

          await expect(call(owner)).rejects.toThrow('db down');
          expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
        });

        it('still succeeds when the S3 delete fails', async () => {
          mockProtRepository.findOne.mockResolvedValue(
            buildProt(PROTStatus.DRAFT),
          );
          mockStorageService.deleteFile.mockRejectedValueOnce(
            new Error('S3 unavailable'),
          );

          await expect(call(owner)).resolves.toBeDefined();
          expect(mockProtRepository.save).toHaveBeenCalledTimes(1);
        });
      },
    );

    it('removeFotoKegiatan removes the chosen URL and deletes that object', async () => {
      const prot = buildProt(PROTStatus.DRAFT);
      prot.fotoKegiatan = ['https://bucket/a.jpg', 'https://bucket/b.jpg'];
      mockProtRepository.findOne.mockResolvedValue(prot);

      const result = await service.removeFotoKegiatan('prot-1', 1, owner);

      expect(result.fotoKegiatan).toEqual(['https://bucket/a.jpg']);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'https://bucket/b.jpg',
      );
    });

    it('removeFotoAlat removes the chosen URL and deletes that object', async () => {
      mockProtRepository.findOne.mockResolvedValue(
        buildProt(PROTStatus.REVISI),
      );

      const result = await service.removeFotoAlat('prot-1', 0, 0, owner);

      expect(result.peralatan[0].fotoAlat).toEqual([]);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'https://bucket/alat-1.jpg',
      );
    });
  });
});
