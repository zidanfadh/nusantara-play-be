import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UserRole } from '../users/entities/user.entity';
import { checkSelfReview } from './self-review';
import { VerifikasiReviewDto } from './dto/verifikasi-review.dto';
import { PublishProtDto } from './dto/publish-prot.dto';
import { SubmitKurasiDto } from './dto/submit-kurasi.dto';
import { VerifikasiStatus } from './entities/verifikasi.entity';

describe('checkSelfReview (Phase 26)', () => {
  const steps = ['pick', 'review', 'publish'] as const;

  it.each(steps)('allows anyone who is not the creator (%s)', (step) => {
    expect(
      checkSelfReview({
        creatorId: 'u1',
        actor: { id: 'u2', role: UserRole.PAKAR },
        step,
      }),
    ).toEqual({ override: false, reason: null });
  });

  it.each([UserRole.PAKAR, UserRole.KURATOR_DAERAH, UserRole.PUBLIK])(
    'refuses the creator with role %s at every step, even with a reason',
    (role) => {
      for (const step of steps) {
        expect(() =>
          checkSelfReview({
            creatorId: 'u1',
            actor: { id: 'u1', role },
            step,
            overrideReason: 'alasan yang cukup panjang',
          }),
        ).toThrow(ForbiddenException);
      }
    },
  );

  it('lets the creating admin claim, but not decide or publish without a reason', () => {
    const admin = { id: 'u1', role: UserRole.ADMIN_KPOTI };
    expect(
      checkSelfReview({ creatorId: 'u1', actor: admin, step: 'pick' }),
    ).toEqual({ override: false, reason: null });
    for (const step of ['review', 'publish'] as const) {
      expect(() =>
        checkSelfReview({ creatorId: 'u1', actor: admin, step }),
      ).toThrow(ForbiddenException);
      expect(() =>
        checkSelfReview({
          creatorId: 'u1',
          actor: admin,
          step,
          overrideReason: '   pendek ',
        }),
      ).toThrow(ForbiddenException);
      expect(
        checkSelfReview({
          creatorId: 'u1',
          actor: admin,
          step,
          overrideReason: '  Tidak ada pemeriksa lain  ',
        }),
      ).toEqual({ override: true, reason: 'Tidak ada pemeriksa lain' });
    }
  });

  it('treats a record without creator as not own', () => {
    expect(
      checkSelfReview({
        creatorId: null,
        actor: { id: 'u1', role: UserRole.PAKAR },
        step: 'review',
      }).override,
    ).toBe(false);
  });
});

describe('Phase 26 DTO fields', () => {
  it('selfReviewOverrideReason is optional, 10 to 500 characters, on review and publish', async () => {
    for (const Dto of [VerifikasiReviewDto, PublishProtDto]) {
      const base =
        Dto === VerifikasiReviewDto
          ? { status: VerifikasiStatus.APPROVED }
          : {};
      expect(await validate(plainToInstance(Dto, base))).toHaveLength(0);
      expect(
        await validate(
          plainToInstance(Dto, {
            ...base,
            selfReviewOverrideReason: 'a'.repeat(10),
          }),
        ),
      ).toHaveLength(0);
      expect(
        await validate(
          plainToInstance(Dto, { ...base, selfReviewOverrideReason: 'kurang' }),
        ),
      ).not.toHaveLength(0);
      expect(
        await validate(
          plainToInstance(Dto, {
            ...base,
            selfReviewOverrideReason: 'a'.repeat(501),
          }),
        ),
      ).not.toHaveLength(0);
    }
  });

  it('the resubmit body (SubmitKurasiDto) accepts an empty body and a note up to 500', async () => {
    expect(await validate(plainToInstance(SubmitKurasiDto, {}))).toHaveLength(
      0,
    );
    expect(
      await validate(
        plainToInstance(SubmitKurasiDto, { catatan: 'a'.repeat(500) }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SubmitKurasiDto, { catatan: 'a'.repeat(501) }),
      ),
    ).not.toHaveLength(0);
  });
});
