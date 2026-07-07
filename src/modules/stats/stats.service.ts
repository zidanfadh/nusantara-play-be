import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROT } from '../prot/entities/prot.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';

export interface LandingStats {
  totalProt: number;
  totalProvinsi: number;
  totalEvents: number;
  totalUsers: number;
}

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
        this.protRepository.count(),
        this.protRepository
          .createQueryBuilder('prot')
          .select('prot.provinsiKode')
          .where('prot.provinsiKode IS NOT NULL')
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
