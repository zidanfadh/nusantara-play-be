/**
 * B5 + B7 (Phase 06) against the real local test database:
 * - B5: two parallel picks of one queue item -> exactly one claim.
 * - B7: the kurator's submission note is stored on the queue entry and
 *   returned to the pakar.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { VerifikasiService } from '../../src/modules/prot/verifikasi.service';
import { PROTService } from '../../src/modules/prot/prot.service';
import { Verifikasi } from '../../src/modules/prot/entities/verifikasi.entity';
import { VerifikasiQueue } from '../../src/modules/prot/entities/verifikasi-queue.entity';
import { PROT, PROTStatus } from '../../src/modules/prot/entities/prot.entity';
import { BlockchainService } from '../../src/modules/blockchain/blockchain.service';
import { DaerahService } from '../../src/modules/daerah/daerah.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { UserRole } from '../../src/modules/users/entities/user.entity';
import { Fixtures } from './fixtures';

describe('Verifikasi queue (integration, real database, B5 + B7)', () => {
  let moduleRef: TestingModule;
  let verifikasi: VerifikasiService;
  let protService: PROTService;
  let dataSource: DataSource;
  let fx: Fixtures;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
        TypeOrmModule.forFeature([Verifikasi, VerifikasiQueue, PROT]),
      ],
      providers: [
        VerifikasiService,
        PROTService,
        { provide: BlockchainService, useValue: {} },
        { provide: DaerahService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    verifikasi = moduleRef.get(VerifikasiService);
    protService = moduleRef.get(PROTService);
    dataSource = moduleRef.get(DataSource);
    fx = new Fixtures(dataSource);
  });

  afterAll(async () => {
    await fx.cleanup();
    await moduleRef.close();
  });

  const queueFor = (protId: string) =>
    dataSource.getRepository(VerifikasiQueue).findOneByOrFail({
      prot_id: protId,
    });

  it('2 parallel picks of the same queue item: exactly one succeeds', async () => {
    const kurator = await fx.user(UserRole.KURATOR_DAERAH);
    const [pakarA, pakarB] = await Promise.all([
      fx.user(UserRole.PAKAR),
      fx.user(UserRole.PAKAR),
    ]);
    const prot = await fx.prot(kurator, PROTStatus.DRAFT);
    await protService.submitKurasi(prot.id, kurator.id);
    const queue = await queueFor(prot.id);

    const results = await Promise.allSettled([
      verifikasi.pickFromQueue(queue.id, pakarA.id),
      verifikasi.pickFromQueue(queue.id, pakarB.id),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<VerifikasiQueue> =>
        r.status === 'fulfilled',
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
    expect((rejected[0].reason as Error).message).toBe(
      'PROT ini sudah di-claim oleh pakar lain',
    );

    const winner = fulfilled[0].value.assigned_pakar_id;
    const stored = await queueFor(prot.id);
    expect(stored.assigned_pakar_id).toBe(winner);
    expect(stored.assigned_at).toBeInstanceOf(Date);
  });

  it('only the assigned pakar can release', async () => {
    const kurator = await fx.user(UserRole.KURATOR_DAERAH);
    const [pakarA, pakarB] = await Promise.all([
      fx.user(UserRole.PAKAR),
      fx.user(UserRole.PAKAR),
    ]);
    const prot = await fx.prot(kurator, PROTStatus.DRAFT);
    await protService.submitKurasi(prot.id, kurator.id);
    const queue = await queueFor(prot.id);
    await verifikasi.pickFromQueue(queue.id, pakarA.id);

    await expect(
      verifikasi.releaseFromQueue(queue.id, pakarB.id),
    ).rejects.toThrow(NotFoundException);
    expect((await queueFor(prot.id)).assigned_pakar_id).toBe(pakarA.id);

    const released = await verifikasi.releaseFromQueue(queue.id, pakarA.id);
    expect(released.assigned_pakar_id).toBeNull();
    expect(released.assigned_at).toBeNull();
  });

  it('stores the submission note and returns it to the pakar (B7)', async () => {
    const kurator = await fx.user(UserRole.KURATOR_DAERAH);
    const pakar = await fx.user(UserRole.PAKAR);
    const prot = await fx.prot(kurator, PROTStatus.DRAFT);

    await protService.submitKurasi(
      prot.id,
      kurator.id,
      'Mohon perhatikan aturan permainan.',
    );

    expect((await queueFor(prot.id)).catatan_kurator).toBe(
      'Mohon perhatikan aturan permainan.',
    );

    const available = await verifikasi.getAvailableQueue(1, 500);
    const listed = available.data.find((item) => item.prot_id === prot.id);
    expect(listed?.catatan_kurator).toBe('Mohon perhatikan aturan permainan.');
    // P1: the creator is another user for the pakar.
    expect(listed?.prot.createdBy).toMatchObject({ id: kurator.id });
    expect(listed?.prot.createdBy).not.toHaveProperty('supabase_user_id');
    expect(listed?.prot.createdBy).not.toHaveProperty('last_login_at');

    const queue = await queueFor(prot.id);
    await verifikasi.pickFromQueue(queue.id, pakar.id);
    const mine = await verifikasi.getMyQueue(pakar.id, 1, 50);
    expect(mine.data.map((item) => item.catatan_kurator)).toEqual([
      'Mohon perhatikan aturan permainan.',
    ]);
  });

  it('submitting without a note still works (catatan_kurator null)', async () => {
    const kurator = await fx.user(UserRole.KURATOR_DAERAH);
    const prot = await fx.prot(kurator, PROTStatus.DRAFT);

    const submitted = await protService.submitKurasi(prot.id, kurator.id);

    expect(submitted.status).toBe(PROTStatus.DIKURASI);
    expect((await queueFor(prot.id)).catatan_kurator).toBeNull();
  });
});
