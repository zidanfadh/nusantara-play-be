import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Repository, IsNull } from 'typeorm';
import { Verifikasi, VerifikasiStatus } from './entities/verifikasi.entity';
import { VerifikasiQueue } from './entities/verifikasi-queue.entity';
import { PROT, PROTStatus } from './entities/prot.entity';
import { VerifikasiReviewDto } from './dto/verifikasi-review.dto';
import { DaerahService } from '../daerah/daerah.service';
import { DaerahLevel } from '../daerah/entities/daerah.entity';
import { UserRole } from '../users/entities/user.entity';
import { stripPrivateUserFields } from '../../common/serializers/user-shape';

interface ReviewerContext {
  role?: UserRole;
  daerah_id?: string | null;
}

/**
 * Queue items go to other users (pakar, admin, kurator), so the PROT
 * creator never includes supabase_user_id or last_login_at (P1).
 */
function withoutPrivateCreatorFields(item: VerifikasiQueue): VerifikasiQueue {
  if (!item.prot?.createdBy) {
    return item;
  }
  return {
    ...item,
    prot: {
      ...item.prot,
      createdBy: stripPrivateUserFields(item.prot.createdBy),
    },
  } as VerifikasiQueue;
}

@Injectable()
export class VerifikasiService {
  constructor(
    @InjectRepository(Verifikasi)
    private readonly verifikasiRepository: Repository<Verifikasi>,
    @InjectRepository(VerifikasiQueue)
    private readonly queueRepository: Repository<VerifikasiQueue>,
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
    private readonly blockchainService: BlockchainService,
    private readonly daerahService: DaerahService,
  ) {}

  /**
   * Get available queue (PROT yang belum di-assign ke pakar)
   */
  async getAvailableQueue(
    page = 1,
    limit = 20,
    user?: { role?: UserRole; daerah_id?: string | null },
    provinsiKode?: string,
  ) {
    const where: {
      assigned_pakar_id: ReturnType<typeof IsNull>;
      prot?: { provinsiKode: string };
    } = { assigned_pakar_id: IsNull() };

    if (user?.role === UserRole.KURATOR_DAERAH) {
      if (!user.daerah_id) {
        throw new BadRequestException(
          'Kurator Daerah must have daerah_id assigned',
        );
      }

      const ancestors = await this.daerahService.findAncestors(user.daerah_id);
      const province = ancestors.find(
        (daerah) => daerah.level === DaerahLevel.PROVINSI,
      );

      if (!province) {
        throw new BadRequestException(
          'Kurator Daerah province could not be resolved',
        );
      }

      where.prot = { provinsiKode: province.kode };
    } else if (provinsiKode) {
      where.prot = { provinsiKode };
    }

    const [data, total] = await this.queueRepository.findAndCount({
      where,
      relations: ['prot', 'prot.createdBy'],
      order: { priority: 'DESC', created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: data.map(withoutPrivateCreatorFields),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get queue items assigned to specific pakar
   */
  async getMyQueue(pakarId: string, page = 1, limit = 20) {
    const [data, total] = await this.queueRepository.findAndCount({
      where: { assigned_pakar_id: pakarId },
      relations: ['prot', 'prot.createdBy'],
      order: { assigned_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: data.map(withoutPrivateCreatorFields),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Pakar pick PROT from queue
   */
  async pickFromQueue(
    queueId: string,
    pakarId: string,
    reviewer?: ReviewerContext,
  ): Promise<VerifikasiQueue> {
    const queue = await this.queueRepository.findOne({
      where: { id: queueId },
      relations: ['prot'],
    });

    if (!queue) {
      throw new NotFoundException('Queue item tidak ditemukan');
    }

    if (queue.assigned_pakar_id) {
      throw new BadRequestException('PROT ini sudah di-claim oleh pakar lain');
    }

    // Check if PROT still in DIKURASI status
    if (queue.prot.status !== PROTStatus.DIKURASI) {
      throw new BadRequestException(
        `PROT dengan status ${queue.prot.status} tidak bisa di-pick`,
      );
    }

    await this.ensureKuratorCanAccessProt(queue.prot, reviewer);

    // Race-safe claim (B5): only one concurrent pick can change the row from
    // unassigned to assigned. assigned_at is a JS Date parameter, the same
    // convention as before (timestamp without time zone, app clock).
    const result = await this.queueRepository
      .createQueryBuilder()
      .update(VerifikasiQueue)
      .set({ assigned_pakar_id: pakarId, assigned_at: new Date() })
      .where('id = :queueId', { queueId })
      .andWhere('assigned_pakar_id IS NULL')
      .execute();

    if (!result.affected) {
      throw new BadRequestException('PROT ini sudah di-claim oleh pakar lain');
    }

    const claimed = await this.queueRepository.findOne({
      where: { id: queueId },
      relations: ['prot'],
    });
    if (!claimed) {
      throw new NotFoundException('Queue item tidak ditemukan');
    }
    return claimed;
  }

  /**
   * Pakar release PROT back to queue
   */
  async releaseFromQueue(
    queueId: string,
    pakarId: string,
  ): Promise<VerifikasiQueue> {
    // Only the assigned pakar can release (B5), in one conditional UPDATE.
    const result = await this.queueRepository
      .createQueryBuilder()
      .update(VerifikasiQueue)
      .set({ assigned_pakar_id: null, assigned_at: null })
      .where('id = :queueId', { queueId })
      .andWhere('assigned_pakar_id = :pakarId', { pakarId })
      .execute();

    const released = result.affected
      ? await this.queueRepository.findOne({ where: { id: queueId } })
      : null;

    if (!released) {
      throw new NotFoundException(
        'Queue item tidak ditemukan atau bukan milik Anda',
      );
    }

    return released;
  }

  /**
   * Pakar submit review (approve/reject/revision_needed)
   */
  async submitReview(
    protId: string,
    pakarId: string,
    reviewDto: VerifikasiReviewDto,
    reviewer?: ReviewerContext,
  ): Promise<Verifikasi> {
    // 1. Check if PROT exists and assigned to this pakar
    const queue = await this.queueRepository.findOne({
      where: { prot_id: protId, assigned_pakar_id: pakarId },
      relations: ['prot'],
    });

    if (!queue) {
      throw new ForbiddenException(
        'PROT ini tidak di-assign ke Anda atau tidak ada di queue',
      );
    }

    const prot = queue.prot;

    if (prot.status !== PROTStatus.DIKURASI) {
      throw new BadRequestException(
        `PROT dengan status ${prot.status} tidak bisa diverifikasi`,
      );
    }

    await this.ensureKuratorCanAccessProt(prot, reviewer);

    // 2. Create verifikasi record
    const verifikasi = this.verifikasiRepository.create({
      prot_id: protId,
      pakar_id: pakarId,
      status: reviewDto.status,
      catatan: reviewDto.catatan || null,
      saran_perbaikan: reviewDto.saran_perbaikan || null,
      dokumen_pendukung: reviewDto.dokumen_pendukung || null,
      verified_at: new Date(),
    });

    await this.verifikasiRepository.save(verifikasi);

    // 3. Update PROT status based on review decision
    switch (reviewDto.status) {
      case VerifikasiStatus.APPROVED:
        prot.status = PROTStatus.DIVERIFIKASI;
        prot.verified_by = pakarId;
        prot.verified_at = new Date();
        break;

      case VerifikasiStatus.REJECTED:
        prot.status = PROTStatus.DRAFT;
        prot.verified_by = null;
        prot.verified_at = null;
        break;

      case VerifikasiStatus.REVISION_NEEDED:
        prot.status = PROTStatus.REVISI;
        prot.verified_by = null;
        prot.verified_at = null;
        break;

      default:
        throw new BadRequestException('Status verifikasi tidak valid');
    }

    await this.protRepository.save(prot);

    // Fire-and-forget blockchain anchoring — does not block the response
    if (reviewDto.status === VerifikasiStatus.APPROVED) {
      this.blockchainService
        .anchorVerification(verifikasi.id)
        .catch((err: Error) => {
          new Logger('VerifikasiService').error(
            `Blockchain anchor failed for verifikasi ${verifikasi.id}: ${err.message}`,
          );
        });
    }

    // 4. Remove from queue
    await this.queueRepository.remove(queue);

    return verifikasi;
  }

  private async ensureKuratorCanAccessProt(
    prot: PROT,
    reviewer?: ReviewerContext,
  ): Promise<void> {
    if (reviewer?.role !== UserRole.KURATOR_DAERAH) {
      return;
    }

    const provinceCode = await this.getKuratorProvinceCode(reviewer);
    if (prot.provinsiKode !== provinceCode) {
      throw new ForbiddenException(
        'Kurator Daerah hanya bisa memverifikasi PROT dari provinsinya sendiri',
      );
    }
  }

  private async getKuratorProvinceCode(
    reviewer: ReviewerContext,
  ): Promise<string> {
    if (!reviewer.daerah_id) {
      throw new BadRequestException(
        'Kurator Daerah must have daerah_id assigned',
      );
    }

    const ancestors = await this.daerahService.findAncestors(
      reviewer.daerah_id,
    );
    const province = ancestors.find(
      (daerah) => daerah.level === DaerahLevel.PROVINSI,
    );

    if (!province) {
      throw new BadRequestException(
        'Kurator Daerah province could not be resolved',
      );
    }

    return province.kode;
  }

  /**
   * Get verification history for a PROT
   */
  async getVerifikasiHistory(protId: string) {
    const history = await this.verifikasiRepository.find({
      where: { prot_id: protId },
      relations: ['pakar'],
      order: { created_at: 'DESC' },
    });
    // The pakar is another user: no supabase_user_id / last_login_at (P1).
    return history.map((item) => ({
      ...item,
      pakar: stripPrivateUserFields(item.pakar),
    }));
  }

  /**
   * Get verification statistics
   */
  async getVerifikasiStats() {
    const [totalPending, totalApproved, totalRejected, totalRevision] =
      await Promise.all([
        this.queueRepository.count(),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.APPROVED },
        }),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.REJECTED },
        }),
        this.verifikasiRepository.count({
          where: { status: VerifikasiStatus.REVISION_NEEDED },
        }),
      ]);

    const totalProtByStatus = await this.protRepository
      .createQueryBuilder('prot')
      .select('prot.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('prot.status')
      .getRawMany();

    return {
      queue: {
        totalPending,
      },
      verifikasi: {
        totalApproved,
        totalRejected,
        totalRevision,
        total: totalApproved + totalRejected + totalRevision,
      },
      protByStatus: totalProtByStatus.reduce(
        (acc, item) => {
          acc[item.status] = parseInt(item.count, 10);
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
