/**
 * Phase 15: request validation of the rewards endpoints (the global
 * ValidationPipe uses the same class-validator rules, with whitelist and
 * forbidNonWhitelisted).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminAdjustDto,
  LeaderboardQueryDto,
  LedgerQueryDto,
  RecordActivityDto,
} from '../dto/rewards.dto';

async function errorsOf<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('rewards DTOs', () => {
  describe('RecordActivityDto', () => {
    it.each(['PROVINCE_ENTER', 'PROT_VIEW'])('accepts %s', async (type) => {
      expect(await errorsOf(RecordActivityDto, { type, refId: '16' })).toEqual(
        [],
      );
    });

    it.each(['PASPOR_STAMP', 'ADMIN_ADJUST', 'prot_view', '', 42, undefined])(
      'refuses type %p (a client can never trigger other rules)',
      async (type) => {
        expect(
          await errorsOf(RecordActivityDto, { type, refId: '16' }),
        ).toContain('type');
      },
    );

    it('refuses a missing, empty or long refId, and extra fields', async () => {
      expect(
        await errorsOf(RecordActivityDto, { type: 'PROT_VIEW' }),
      ).toContain('refId');
      expect(
        await errorsOf(RecordActivityDto, { type: 'PROT_VIEW', refId: '' }),
      ).toContain('refId');
      expect(
        await errorsOf(RecordActivityDto, {
          type: 'PROT_VIEW',
          refId: 'x'.repeat(65),
        }),
      ).toContain('refId');
      expect(
        await errorsOf(RecordActivityDto, {
          type: 'PROVINCE_ENTER',
          refId: '16',
          idempotencyKey: 'mine',
          xp: 1000,
        }),
      ).toEqual(expect.arrayContaining(['idempotencyKey', 'xp']));
    });
  });

  describe('LedgerQueryDto', () => {
    it('defaults page 1, limit 20; limit max 50', async () => {
      const dto = plainToInstance(LedgerQueryDto, {});
      expect(dto).toMatchObject({ page: 1, limit: 20 });
      expect(
        await errorsOf(LedgerQueryDto, { page: '2', limit: '50' }),
      ).toEqual([]);
      expect(await errorsOf(LedgerQueryDto, { limit: '51' })).toContain(
        'limit',
      );
      expect(await errorsOf(LedgerQueryDto, { page: '0' })).toContain('page');
    });
  });

  describe('LeaderboardQueryDto', () => {
    it('scope national|province, two-digit province code', async () => {
      expect(plainToInstance(LeaderboardQueryDto, {}).scope).toBe('national');
      expect(
        await errorsOf(LeaderboardQueryDto, {
          scope: 'province',
          provinsiKode: '16',
        }),
      ).toEqual([]);
      expect(await errorsOf(LeaderboardQueryDto, { scope: 'world' })).toContain(
        'scope',
      );
      expect(
        await errorsOf(LeaderboardQueryDto, {
          scope: 'province',
          provinsiKode: '160',
        }),
      ).toContain('provinsiKode');
    });
  });

  describe('AdminAdjustDto', () => {
    const valid = {
      userId: '11111111-1111-4111-8111-111111111111',
      currency: 'XP',
      amount: -25,
      reason: 'Koreksi data uji',
    };

    it('accepts a valid adjustment (negative amounts allowed)', async () => {
      expect(await errorsOf(AdminAdjustDto, valid)).toEqual([]);
    });

    it('reason is required, trimmed, at least 5 characters', async () => {
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, reason: undefined }),
      ).toContain('reason');
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, reason: '   abcd   ' }),
      ).toContain('reason');
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, reason: '  abcde ' }),
      ).toEqual([]);
    });

    it('refuses amount 0, fractions, huge amounts, unknown currencies and bad ids', async () => {
      expect(await errorsOf(AdminAdjustDto, { ...valid, amount: 0 })).toContain(
        'amount',
      );
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, amount: 1.5 }),
      ).toContain('amount');
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, amount: 1_000_001 }),
      ).toContain('amount');
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, currency: 'IDR' }),
      ).toContain('currency');
      expect(
        await errorsOf(AdminAdjustDto, { ...valid, userId: 'abc' }),
      ).toContain('userId');
    });
  });
});
