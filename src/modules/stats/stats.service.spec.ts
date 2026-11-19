import { Repository } from 'typeorm';
import { PROT, PROTStatus } from '../prot/entities/prot.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { PUBLISHED_PROT_STATUS, StatsService } from './stats.service';

function makeService(options: {
  protCount: number;
  provinsi: string[];
  events: number;
  users: number;
}) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    getRawMany: jest
      .fn()
      .mockResolvedValue(
        options.provinsi.map((kode) => ({ prot_provinsi_kode: kode })),
      ),
  };
  const protRepository = {
    count: jest.fn().mockResolvedValue(options.protCount),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  const eventRepository = {
    count: jest.fn().mockResolvedValue(options.events),
  };
  const userRepository = { count: jest.fn().mockResolvedValue(options.users) };
  const service = new StatsService(
    protRepository as unknown as Repository<PROT>,
    eventRepository as unknown as Repository<Event>,
    userRepository as unknown as Repository<User>,
  );
  return { service, protRepository, qb, eventRepository, userRepository };
}

describe('StatsService.getLandingStats (Phase 18: published PROT only)', () => {
  it('counts only ARSIP_NASIONAL PROT', async () => {
    const { service, protRepository } = makeService({
      protCount: 3,
      provinsi: ['16'],
      events: 1,
      users: 5,
    });
    await service.getLandingStats();
    expect(PUBLISHED_PROT_STATUS).toBe(PROTStatus.ARSIP_NASIONAL);
    expect(protRepository.count).toHaveBeenCalledWith({
      where: { status: PROTStatus.ARSIP_NASIONAL },
    });
  });

  it('counts only the provinces of ARSIP_NASIONAL PROT', async () => {
    const { service, qb } = makeService({
      protCount: 3,
      provinsi: ['16', '51'],
      events: 1,
      users: 5,
    });
    await service.getLandingStats();
    expect(qb.where).toHaveBeenCalledWith('prot.status = :status', {
      status: PROTStatus.ARSIP_NASIONAL,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('prot.provinsiKode IS NOT NULL');
    expect(qb.distinct).toHaveBeenCalledWith(true);
  });

  it('returns the published counts plus all events and users', async () => {
    const { service } = makeService({
      protCount: 3,
      provinsi: ['16', '51'],
      events: 2,
      users: 7,
    });
    await expect(service.getLandingStats()).resolves.toEqual({
      totalProt: 3,
      totalProvinsi: 2,
      totalEvents: 2,
      totalUsers: 7,
    });
  });
});
