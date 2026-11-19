import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROT, PROTStatus } from '../prot/entities/prot.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';

export interface LandingStats {
  totalProt: number;
  totalProvinsi: number;
  totalEvents: number;
  totalUsers: number;
}

/**
 * Only published PROT count for the landing statistics (Phase 18, owner decision): the same set the public
 * `GET /prot` list, the Jelajah map and the intro bumper show. Drafts and PROT in curation are never counted.
 */
export const PUBLISHED_PROT_STATUS = PROTStatus.ARSIP_NASIONAL;

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PROT)
    private readonly protRepository: Repository<PROT>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getLandingStats(): Promise<LandingStats> {
    const [totalProt, provinsiResult, totalEvents, totalUsers] =
      await Promise.all([
        this.protRepository.count({
          where: { status: PUBLISHED_PROT_STATUS },
        }),
        this.protRepository
          .createQueryBuilder('prot')
          .select('prot.provinsiKode')
          .where('prot.status = :status', { status: PUBLISHED_PROT_STATUS })
          .andWhere('prot.provinsiKode IS NOT NULL')
          .distinct(true)
          .getRawMany(),
        this.eventRepository.count(),
        this.userRepository.count(),
      ]);

    return {
      totalProt,
      totalProvinsi: provinsiResult.length,
      totalEvents,
      totalUsers,
    };
  }
}
