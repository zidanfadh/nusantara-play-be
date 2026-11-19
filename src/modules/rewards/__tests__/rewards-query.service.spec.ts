/**
 * Phase 15: leaderboard caching and shape of RewardsQueryService with a fake
 * database (the SQL itself runs in the e2e test).
 */
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RewardsQueryService } from '../rewards-query.service';

const USER = '11111111-1111-4111-8111-111111111111';

function fakeDb() {
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    if (/FROM daerah/.test(sql)) {
      return Promise.resolve(params[0] === '16' ? [{}] : []);
    }
    if (/RANK\(\)/.test(sql)) {
      return Promise.resolve([
        {
          id: 'u1',
          full_name: 'Pemain Satu',
          avatar_url: null,
          institution: null,
          // Never selected by the real SQL; must not leak if it ever were.
          email: 'leak@example.test',
          xp: 300,
          level: 3,
          rank: 1,
        },
      ]);
    }
    if (/AS ahead/.test(sql)) {
      return Promise.resolve([{ xp: 0, ahead: 1 }]);
    }
    return Promise.resolve([]);
  });
  return { query };
}

describe('RewardsQueryService leaderboard', () => {
  afterEach(() => jest.useRealTimers());

  it('returns only the public user shape and caches the top list for 60 s per scope', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-19T10:00:00Z') });
    const db = fakeDb();
    const service = new RewardsQueryService(db as unknown as DataSource);
    const topCalls = () =>
      db.query.mock.calls.filter(([sql]) => /RANK\(\)/.test(sql)).length;

    const first = await service.getLeaderboard(USER, 'national', undefined);
    expect(first.entries).toEqual([
      {
        rank: 1,
        user: {
          id: 'u1',
          full_name: 'Pemain Satu',
          avatar_url: null,
          institution: null,
        },
        xp: 300,
        level: 3,
      },
    ]);
    expect(first.me).toEqual({ rank: null, xp: 0 });

    await service.getLeaderboard(USER, 'national', undefined);
    expect(topCalls()).toBe(1);
    // Another scope has its own cache entry.
    await service.getLeaderboard(USER, 'province', '16');
    expect(topCalls()).toBe(2);

    jest.setSystemTime(new Date('2026-11-19T10:00:59Z'));
    await service.getLeaderboard(USER, 'national', undefined);
    expect(topCalls()).toBe(2);
    jest.setSystemTime(new Date('2026-11-19T10:01:01Z'));
    await service.getLeaderboard(USER, 'national', undefined);
    expect(topCalls()).toBe(3);
  });

  it('scope=province needs a known province code', async () => {
    const service = new RewardsQueryService(fakeDb() as unknown as DataSource);
    await expect(
      service.getLeaderboard(USER, 'province', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getLeaderboard(USER, 'province', '99'),
    ).rejects.toThrow('Unknown province');
  });
});
