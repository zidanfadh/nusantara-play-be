/**
 * Example integration test (Phase 05): DaerahService against the real local
 * test database (nusantara_play_test), seeded by test/global-setup-db.ts.
 * Proves the integration setup works; no mocks.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from '../../src/config/data-source-options';
import { DaerahService } from '../../src/modules/daerah/daerah.service';
import {
  Daerah,
  DaerahLevel,
} from '../../src/modules/daerah/entities/daerah.entity';

describe('DaerahService (integration, real database)', () => {
  let moduleRef: TestingModule;
  let service: DaerahService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          buildDataSourceOptions((key) => process.env[key]),
        ),
        TypeOrmModule.forFeature([Daerah]),
      ],
      providers: [DaerahService],
    }).compile();
    service = moduleRef.get(DaerahService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('runs against the local test database', () => {
    expect(process.env.DATABASE_NAME).toBe('nusantara_play_test');
  });

  it('reads the 34 seeded provinces', async () => {
    const result = await service.findProvinces({ page: 1, limit: 100 });

    expect(result.pagination.total).toBe(34);
    expect(result.data).toHaveLength(34);
    expect(result.data.every((d) => d.level === DaerahLevel.PROVINSI)).toBe(
      true,
    );
    expect(result.data.map((d) => d.kode)).toEqual(
      expect.arrayContaining(['11', '31', '32', '34', '92']),
    );
  });

  it('links a kabupaten/kota to its province', async () => {
    const jawaBarat = await service.findByKode('32');
    const children = await service.findChildren(jawaBarat.id, 1, 100);

    expect(children.pagination.total).toBeGreaterThan(0);
    expect(children.data.map((d) => d.kode)).toContain('32.73');
    expect(children.data.every((d) => d.parent_id === jawaBarat.id)).toBe(true);
  });
});
