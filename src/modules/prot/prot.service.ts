import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROT, PROTJenis, TargetUsia, PROTStatus } from './entities/prot.entity';
import { CreatePROTDto } from './dto/create-prot.dto';
import { UpdatePROTDto } from './dto/update-prot.dto';
import { QueryPROTDto } from './dto/query-prot.dto';
import { DaerahService } from '../daerah/daerah.service';
import { StorageService } from '../storage/storage.service';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class PROTService {
  constructor(
    @InjectRepository(PROT)
    private protRepository: Repository<PROT>,
    @InjectRepository(VerifikasiQueue)
    private queueRepository: Repository<VerifikasiQueue>,
    private daerahService: DaerahService,
    private storageService: StorageService,
  ) { }

  async create(createPROTDto: CreatePROTDto, createdBy: string): Promise<PROT> {
    // Validate daerah cascade
    await this.validateDaerahKode(createPROTDto);

    const prot = this.protRepository.create({
      ...createPROTDto,
      created_by: createdBy,
      status: PROTStatus.DRAFT, // Explicit default
    });
    return this.protRepository.save(prot);
  }

  private async enrichWithDaerahNames(prot: PROT): Promise<PROT & {
    provinsiName: string | null;
    kabkotaName: string | null;
    kecamatanName: string | null;
    desaName: string | null;
  }> {
    const resolveName = async (kode: string | null | undefined): Promise<string | null> => {
      if (!kode) return null;
      try {
        const daerah = await this.daerahService.findByKode(kode);
        return daerah.nama;
      } catch {
        return null;
      }
    };

    const [provinsiName, kabkotaName, kecamatanName, desaName] = await Promise.all([
      resolveName(prot.provinsiKode),
      resolveName(prot.kabkotaKode),
      resolveName(prot.kecamatanKode),
      resolveName(prot.desaKode),
    ]);

    return { ...prot, provinsiName, kabkotaName, kecamatanName, desaName };
  }

  async findAll(
    query: QueryPROTDto,
    user?: User,
  ): Promise<{
    data: (PROT & {
      provinsiName: string | null;
      kabkotaName: string | null;
      kecamatanName: string | null;
      desaName: string | null;
    })[];
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
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // DEBUG: Log user info
    console.log('[PROT findAll] User:', user ? { id: user.id, role: user.role, email: user.email } : 'No user');

    const queryBuilder = this.protRepository.createQueryBuilder('prot');

    // Status filter based on role
    if (!user || user.role === UserRole.PUBLIK) {
      // Public users only see published
      console.log('[PROT findAll] Applying PUBLIC filter (ARSIP_NASIONAL only)');
      queryBuilder.andWhere('prot.status = :roleStatus', { roleStatus: PROTStatus.ARSIP_NASIONAL });
    } else if (user.role === UserRole.KURATOR_DAERAH) {
      // Kurator see own PROT or published
      console.log('[PROT findAll] Applying KURATOR_DAERAH filter (own + ARSIP_NASIONAL)');
      queryBuilder.andWhere(
        '(prot.created_by = :userId OR prot.status = :roleStatus)',
        { userId: user.id, roleStatus: PROTStatus.ARSIP_NASIONAL },
      );
    } else if (user.role === UserRole.PAKAR) {
      // Pakar see DIKURASI + DIVERIFIKASI + ARSIP_NASIONAL
      console.log('[PROT findAll] Applying PAKAR filter (DIKURASI + DIVERIFIKASI + ARSIP_NASIONAL)');
      queryBuilder.andWhere(
        'prot.status IN (:...roleStatuses)',
        { roleStatuses: [PROTStatus.DIKURASI, PROTStatus.DIVERIFIKASI, PROTStatus.ARSIP_NASIONAL] },
      );
    } else {
      // ADMIN_KPOTI sees all statuses (no filter applied)
      console.log('[PROT findAll] Applying ADMIN filter (all statuses, no filter)');
    }

    if (query.jenis) {
      queryBuilder.andWhere('prot.jenis = :jenis', { jenis: query.jenis });
    }

    if (query.provinsi) {
      queryBuilder.andWhere('prot.provinsiKode = :provinsi', {
        provinsi: query.provinsi,
      });
    }

    if (query.kabkota) {
      queryBuilder.andWhere('prot.kabkotaKode = :kabkota', {
        kabkota: query.kabkota,
      });
    }

    if (query.kecamatan) {
      queryBuilder.andWhere('prot.kecamatanKode = :kecamatan', {
        kecamatan: query.kecamatan,
      });
    }

    if (query.desa) {
      queryBuilder.andWhere('prot.desaKode = :desa', { desa: query.desa });
    }

    if (query.targetUsia) {
      queryBuilder.andWhere('prot.targetUsia = :targetUsia', {
        targetUsia: query.targetUsia,
      });
    }

    if (query.search) {
      queryBuilder.andWhere('prot.nama ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('prot.status = :status', { status: query.status });
    }

    if (query.created_by) {
      queryBuilder.andWhere('prot.created_by = :created_by', { created_by: query.created_by });
    }

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    const enrichedData = await Promise.all(data.map((prot) => this.enrichWithDaerahNames(prot)));

    return {
      data: enrichedData,
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

  async findOne(id: string): Promise<PROT & {
    provinsiName: string | null;
    kabkotaName: string | null;
    kecamatanName: string | null;
    desaName: string | null;
  }> {
    const prot = await this.protRepository.findOne({ where: { id } });
    if (!prot) {
      throw new NotFoundException(`PROT with ID ${id} not found`);
    }
    return this.enrichWithDaerahNames(prot);
  }

  async update(
    id: string,
    updatePROTDto: UpdatePROTDto,
    userId: string,
    userRole: UserRole,
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    // Check ownership (kurator can only edit own PROT, admin can edit all)
    if (userRole === UserRole.KURATOR_DAERAH && prot.created_by !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses untuk edit PROT ini');
    }

    // Check status (only DRAFT or REVISI can be edited)
    if (![PROTStatus.DRAFT, PROTStatus.REVISI].includes(prot.status)) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa diedit`,
      );
    }

    // Validate daerah cascade if provided
    const dto = updatePROTDto as Partial<CreatePROTDto>;
    if (
      dto.provinsiKode !== undefined ||
      dto.kabkotaKode !== undefined ||
      dto.kecamatanKode !== undefined ||
      dto.desaKode !== undefined
    ) {
      await this.validateDaerahKode({
        ...prot,
        ...dto,
      } as CreatePROTDto);
    }

    Object.assign(prot, updatePROTDto);
    return this.protRepository.save(prot);
  }

  async remove(id: string): Promise<void> {
    const prot = await this.findOne(id);
    await this.protRepository.remove(prot);
  }

  async addFotoKegiatan(
    id: string,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/foto-kegiatan')),
    );

    prot.fotoKegiatan = prot.fotoKegiatan || [];
    prot.fotoKegiatan.push(...urls);

    return this.protRepository.save(prot);
  }

  async addVideoKegiatan(
    id: string,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/video-kegiatan')),
    );

    prot.videoKegiatan = prot.videoKegiatan || [];
    prot.videoKegiatan.push(...urls);

    return this.protRepository.save(prot);
  }

  async removeFotoKegiatan(id: string, index: number): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.fotoKegiatan || prot.fotoKegiatan.length === 0) {
      throw new BadRequestException('No foto kegiatan to remove');
    }

    if (index < 0 || index >= prot.fotoKegiatan.length) {
      throw new BadRequestException(`Invalid index: ${index}`);
    }

    // Delete file from S3
    await this.storageService.deleteFile(prot.fotoKegiatan[index]);

    prot.fotoKegiatan.splice(index, 1);
    return this.protRepository.save(prot);
  }

  async removeVideoKegiatan(id: string, index: number): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.videoKegiatan || prot.videoKegiatan.length === 0) {
      throw new BadRequestException('No video kegiatan to remove');
    }

    if (index < 0 || index >= prot.videoKegiatan.length) {
      throw new BadRequestException(`Invalid index: ${index}`);
    }

    // Delete file from S3
    await this.storageService.deleteFile(prot.videoKegiatan[index]);

    prot.videoKegiatan.splice(index, 1);
    return this.protRepository.save(prot);
  }

  async addDokumenKurikulum(
    id: string,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/dokumen-kurikulum')),
    );

    prot.dokumenKurikulum = prot.dokumenKurikulum || [];
    prot.dokumenKurikulum.push(...urls);

    return this.protRepository.save(prot);
  }

  async removeDokumenKurikulum(id: string, index: number): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.dokumenKurikulum || prot.dokumenKurikulum.length === 0) {
      throw new BadRequestException('No dokumen kurikulum to remove');
    }

    if (index < 0 || index >= prot.dokumenKurikulum.length) {
      throw new BadRequestException(`Invalid index: ${index}`);
    }

    await this.storageService.deleteFile(prot.dokumenKurikulum[index]);

    prot.dokumenKurikulum.splice(index, 1);
    return this.protRepository.save(prot);
  }

  async addFotoAlat(
    id: string,
    peralatanIndex: number,
    files: Express.Multer.File[],
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.peralatan || peralatanIndex < 0 || peralatanIndex >= prot.peralatan.length) {
      throw new BadRequestException(`Invalid peralatan index: ${peralatanIndex}`);
    }

    const urls = await Promise.all(
      files.map((file) => this.storageService.uploadFile(file, 'prot/peralatan')),
    );

    prot.peralatan[peralatanIndex].fotoAlat = prot.peralatan[peralatanIndex].fotoAlat || [];
    prot.peralatan[peralatanIndex].fotoAlat.push(...urls);

    return this.protRepository.save(prot);
  }

  async removeFotoAlat(
    id: string,
    peralatanIndex: number,
    fotoIndex: number,
  ): Promise<PROT> {
    const prot = await this.findOne(id);

    if (!prot.peralatan || peralatanIndex < 0 || peralatanIndex >= prot.peralatan.length) {
      throw new BadRequestException(`Invalid peralatan index: ${peralatanIndex}`);
    }

    const fotoAlat = prot.peralatan[peralatanIndex].fotoAlat;
    if (!fotoAlat || fotoAlat.length === 0) {
      throw new BadRequestException('No foto alat to remove');
    }

    if (fotoIndex < 0 || fotoIndex >= fotoAlat.length) {
      throw new BadRequestException(`Invalid foto index: ${fotoIndex}`);
    }

    await this.storageService.deleteFile(fotoAlat[fotoIndex]);

    fotoAlat.splice(fotoIndex, 1);
    return this.protRepository.save(prot);
  }

  async submitKurasi(protId: string, userId: string): Promise<PROT> {
    const prot = await this.protRepository.findOne({
      where: { id: protId },
    });

    if (!prot) {
      throw new NotFoundException('PROT tidak ditemukan');
    }

    // Check ownership
    if (prot.created_by !== userId) {
      throw new ForbiddenException('Anda bukan pemilik PROT ini');
    }

    // Check status
    if (prot.status !== PROTStatus.DRAFT) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa di-submit`,
      );
    }

    // Update status
    prot.status = PROTStatus.DIKURASI;
    prot.submitted_at = new Date();

    await this.protRepository.save(prot);

    // Create queue entry
    const queue = this.queueRepository.create({
      prot_id: protId,
      priority: 0,
    });

    await this.queueRepository.save(queue);

    return prot;
  }

  async resubmitAfterRevisi(protId: string, userId: string): Promise<PROT> {
    const prot = await this.protRepository.findOne({
      where: { id: protId },
    });

    if (!prot) {
      throw new NotFoundException('PROT tidak ditemukan');
    }

    // Check ownership
    if (prot.created_by !== userId) {
      throw new ForbiddenException('Anda bukan pemilik PROT ini');
    }

    // Check status
    if (prot.status !== PROTStatus.REVISI) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa di-resubmit`,
      );
    }

    // Update status
    prot.status = PROTStatus.DIKURASI;
    prot.submitted_at = new Date();

    await this.protRepository.save(prot);

    // Re-create queue entry
    const queue = this.queueRepository.create({
      prot_id: protId,
      priority: 0,
    });

    await this.queueRepository.save(queue);

    return prot;
  }

  async publishToArsipNasional(protId: string, adminId: string): Promise<PROT> {
    const prot = await this.protRepository.findOne({
      where: { id: protId },
    });

    if (!prot) {
      throw new NotFoundException('PROT tidak ditemukan');
    }

    // Check status
    if (prot.status !== PROTStatus.DIVERIFIKASI) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa dipublish. Harus DIVERIFIKASI dulu.`,
      );
    }

    // Update status
    prot.status = PROTStatus.ARSIP_NASIONAL;
    prot.published_by = adminId;
    prot.published_at = new Date();

    return this.protRepository.save(prot);
  }

  private async validateDaerahKode(dto: CreatePROTDto): Promise<void> {
    // Cascade validation: if child is provided, parent must be provided and valid
    if (dto.desaKode) {
      if (!dto.kecamatanKode) {
        throw new BadRequestException('kecamatanKode is required when desaKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.desaKode);
      } catch {
        throw new BadRequestException(`Invalid desaKode: ${dto.desaKode}`);
      }
    }

    if (dto.kecamatanKode) {
      if (!dto.kabkotaKode) {
        throw new BadRequestException('kabkotaKode is required when kecamatanKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.kecamatanKode);
      } catch {
        throw new BadRequestException(`Invalid kecamatanKode: ${dto.kecamatanKode}`);
      }
    }

    if (dto.kabkotaKode) {
      if (!dto.provinsiKode) {
        throw new BadRequestException('provinsiKode is required when kabkotaKode is provided');
      }
      try {
        await this.daerahService.findByKode(dto.kabkotaKode);
      } catch {
        throw new BadRequestException(`Invalid kabkotaKode: ${dto.kabkotaKode}`);
      }
    }

    if (dto.provinsiKode) {
      try {
        await this.daerahService.findByKode(dto.provinsiKode);
      } catch {
        throw new BadRequestException(`Invalid provinsiKode: ${dto.provinsiKode}`);
      }
    }
  }
}
