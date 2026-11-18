/**
 * Local database setup: schema + reference data (+ optional demo data).
 *
 *   npm run db:setup                              # target from .env.local / .env (nusantara_play_dev)
 *   npm run db:setup -- --database=nusantara_play_test
 *   npm run db:setup -- --no-demo                 # skip the DEMO dataset
 *
 * LOCAL DEVELOPMENT AND TESTS ONLY. It refuses to run unless the target host
 * is localhost or 127.0.0.1 AND the database name ends with _dev or _test.
 *
 * Why this exists: the repo cannot build a schema from scratch
 * (src/database/migrations/*.sql and src/migrations/*.ts conflict). Until a
 * production schema dump is available, the TypeORM entities are the source of
 * truth for the LOCAL schema (decision of Phase 05).
 *
 * Steps (every step is idempotent, so running it twice is safe):
 * 1. Create the extensions (uuid-ossp, pgcrypto).
 * 2. Build the schema from the entities with DataSource.synchronize(), using
 *    the shared buildDataSourceOptions (src/config/data-source-options.ts).
 * 3. Migration baseline: record every migration in src/migrations/ as already
 *    applied (see markMigrationsAsApplied).
 * 4. Seed daerah reference data from the existing seeds (see seedDaerah).
 * 5. Optionally seed a small, clearly fake DEMO dataset (see seedDemoData).
 *
 * Also used by the Jest global setup of the integration and e2e tests
 * (test/global-setup-db.ts).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource, QueryRunner } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { buildDataSourceOptions } from '../config/data-source-options';
import { SeedKecamatanKelurahanDesa1740500100000 } from '../migrations/1740500100000-SeedKecamatanKelurahanDesa';
import {
  User,
  UserRole,
  UserStatus,
} from '../modules/users/entities/user.entity';
import {
  PROT,
  PROTJenis,
  PROTStatus,
  TargetUsia,
} from '../modules/prot/entities/prot.entity';
import {
  Event,
  EventJenis,
  EventStatus,
} from '../modules/events/entities/event.entity';
import { Daerah } from '../modules/daerah/entities/daerah.entity';

export interface LocalDbSetupOptions {
  /** Overrides DATABASE_NAME (DATABASE_URL must then be unset). */
  database?: string;
  /** Seed the DEMO dataset. Default true. */
  demo?: boolean;
  /** Environment to read DATABASE_* from. Default process.env. */
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
}

export interface LocalDbTarget {
  host: string;
  database: string;
}

const ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
const ALLOWED_DB_SUFFIXES = ['_dev', '_test'];

/** Fixed ids so the DEMO seed is idempotent and easy to recognise. */
export const DEMO_IDS = {
  user: '00000000-0000-4000-8000-00000000de01',
  supabaseUser: '00000000-0000-4000-8000-00000000de02',
  prot: [
    '00000000-0000-4000-8000-00000000de11',
    '00000000-0000-4000-8000-00000000de12',
    '00000000-0000-4000-8000-00000000de13',
  ],
  event: '00000000-0000-4000-8000-00000000de21',
  /** DEMO PROT in Sumatera Selatan (kode 16) for the Jelajah pilot scene (Phase 11). */
  protSumsel: [
    '00000000-0000-4000-8000-00000000de31',
    '00000000-0000-4000-8000-00000000de32',
    '00000000-0000-4000-8000-00000000de33',
    '00000000-0000-4000-8000-00000000de34',
  ],
} as const;

/** Neutral placeholder text of the DEMO Sumatera Selatan PROT (no cultural facts). */
export const DEMO_SUMSEL_TEXT =
  'Contoh data untuk pengembangan, bukan data budaya asli.';

export const DEMO_USER_EMAIL = 'demo-kurator@example.test';

/** Returns host and database name only (never user or password). */
export function describeTarget(
  options: PostgresConnectionOptions,
): LocalDbTarget {
  if (options.url) {
    const url = new URL(options.url);
    return {
      host: url.hostname,
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  }
  return { host: options.host ?? '', database: options.database ?? '' };
}

/** Throws unless the target is a local _dev or _test database. */
export function assertSafeLocalTarget(target: LocalDbTarget): void {
  if (!ALLOWED_HOSTS.includes(target.host)) {
    throw new Error(
      `Refusing to run: host "${target.host}" is not localhost or 127.0.0.1.`,
    );
  }
  if (!ALLOWED_DB_SUFFIXES.some((suffix) => target.database.endsWith(suffix))) {
    throw new Error(
      `Refusing to run: database "${target.database}" does not end with _dev or _test.`,
    );
  }
}

export function buildLocalSetupOptions(
  setup: LocalDbSetupOptions = {},
): PostgresConnectionOptions {
  const env = setup.env ?? process.env;
  if (setup.database && env.DATABASE_URL) {
    throw new Error(
      'Refusing to run: --database cannot be combined with DATABASE_URL. Unset DATABASE_URL.',
    );
  }
  const getEnv = (key: string): string | undefined =>
    key === 'DATABASE_NAME' && setup.database ? setup.database : env[key];
  return {
    ...buildDataSourceOptions(getEnv),
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

export async function setupLocalDatabase(
  setup: LocalDbSetupOptions = {},
): Promise<void> {
  const log = setup.log ?? ((message: string) => console.log(message));
  const options = buildLocalSetupOptions(setup);
  const target = describeTarget(options);
  log(`[db:setup] Target: host=${target.host} database=${target.database}`);
  assertSafeLocalTarget(target);

  const dataSource = new DataSource(options);
  await dataSource.initialize();
  try {
    await createExtensions(dataSource);
    await synchronizeSchema(dataSource, log);
    await markMigrationsAsApplied(dataSource, log);
    await seedDaerah(dataSource, log);
    if (setup.demo ?? true) {
      await seedDemoData(dataSource, log);
    } else {
      log('[db:setup] DEMO data skipped (--no-demo).');
    }
    log('[db:setup] Done.');
  } finally {
    await dataSource.destroy();
  }
}

async function createExtensions(dataSource: DataSource): Promise<void> {
  // uuid-ossp: uuid_generate_v4() (TypeORM uuid defaults, old migrations).
  // pgcrypto: gen_random_uuid() is built in since PostgreSQL 13, but the
  // production database (Supabase) has pgcrypto, so keep it for parity.
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
}

async function synchronizeSchema(
  dataSource: DataSource,
  log: (message: string) => void,
): Promise<void> {
  await dataSource.synchronize();
  // After synchronize() the entities and the schema must match exactly.
  // Any remaining statement means synchronize() could not create something.
  const pending = await dataSource.driver.createSchemaBuilder().log();
  if (pending.upQueries.length > 0) {
    log(
      // Known: TypeORM always re-proposes dropping and recreating the FKs and
      // indexes of the ManyToMany junction table produk_prot, although the
      // table already matches the entity (see docs/phase-reports/phase-05.md).
      `[db:setup] NOTE: TypeORM still reports ${pending.upQueries.length} schema statements after synchronize():`,
    );
    for (const query of pending.upQueries) {
      log(`  ${query.query}`);
    }
  } else {
    log(
      `[db:setup] Schema synchronized from ${dataSource.entityMetadatas.length} entities (no remaining differences).`,
    );
  }
}

/**
 * Migration baseline.
 *
 * synchronize() already created the full current schema, so running the
 * migrations in src/migrations/ on top of it would fail (they CREATE tables
 * and types that now exist, and their enum type names differ from the ones
 * synchronize() creates). We therefore insert every existing migration into
 * the TypeORM "migrations" table as already applied. `npm run migration:run`
 * then has nothing pending, and any NEW migration added later runs cleanly on
 * top of this baseline, exactly like on a database that ran all migrations.
 */
async function markMigrationsAsApplied(
  dataSource: DataSource,
  log: (message: string) => void,
): Promise<void> {
  const table = dataSource.options.migrationsTableName ?? 'migrations';
  // Same layout TypeORM itself creates for its migrations table.
  await dataSource.query(
    `CREATE TABLE IF NOT EXISTS "${table}" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_${table}_id" PRIMARY KEY ("id"))`,
  );
  let inserted = 0;
  const migrations = [...dataSource.migrations].map((migration) => {
    const name = migration.name ?? migration.constructor.name;
    return { name, timestamp: parseInt(name.slice(-13), 10) };
  });
  migrations.sort((a, b) => a.timestamp - b.timestamp);
  for (const { name, timestamp } of migrations) {
    const rows: unknown[] = await dataSource.query(
      `INSERT INTO "${table}" ("timestamp", "name")
       SELECT $1::bigint, $2::varchar
       WHERE NOT EXISTS (SELECT 1 FROM "${table}" WHERE "name" = $2::varchar)
       RETURNING "id"`,
      [timestamp, name],
    );
    inserted += rows.length;
  }
  const pending = await dataSource.showMigrations();
  log(
    `[db:setup] Migration baseline: ${migrations.length} migrations recorded as applied (${inserted} new). Pending: ${pending ? 'YES (unexpected)' : 'none'}.`,
  );
}

/**
 * Daerah reference data, reused from the existing seeds (no invented data):
 * - provinsi + kabupaten/kota: the INSERT statements of
 *   src/database/migrations/002_replace_daerah_data.sql (34 + 514 rows,
 *   source docs/daerah_updated.csv). Its TRUNCATE/BEGIN/COMMIT and the
 *   verification block are not executed; ON CONFLICT (kode) DO NOTHING makes
 *   it idempotent. (src/migrations/1738826000000-SeedDaerahBPS.ts is not used:
 *   it has kab/kota for 12 provinces only, with different codes that do not
 *   match the kecamatan CSV.)
 * - prefix backfill: same UPDATEs as
 *   src/migrations/1740500000000-AddKecamatanKelurahanDesa.ts.
 * - kecamatan + kelurahan/desa: runs the up() of the existing seed migration
 *   src/migrations/1740500100000-SeedKecamatanKelurahanDesa.ts (reads
 *   docs/kecamatan_kelurahan_desa.csv and skips codes that already exist).
 */
async function seedDaerah(
  dataSource: DataSource,
  log: (message: string) => void,
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    for (const statement of readProvinsiKabKotaInserts()) {
      await queryRunner.query(statement);
    }
    await backfillPrefix(queryRunner);

    const kecamatanCount = await countLevel(queryRunner, ['kecamatan']);
    if (kecamatanCount === 0) {
      log('[db:setup] Seeding kecamatan/kelurahan/desa from CSV ...');
      await new SeedKecamatanKelurahanDesa1740500100000().up(queryRunner);
    } else {
      log(
        '[db:setup] kecamatan/kelurahan/desa already seeded, skipping the CSV import.',
      );
    }
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }

  const counts: { level: string; count: string }[] = await dataSource.query(
    `SELECT level::text AS level, COUNT(*)::text AS count FROM daerah GROUP BY level ORDER BY MIN(LENGTH(kode)), level`,
  );
  log(
    `[db:setup] daerah rows per level: ${counts.map((c) => `${c.level}=${c.count}`).join(', ')}`,
  );
}

function readProvinsiKabKotaInserts(): string[] {
  const file = path.resolve(
    __dirname,
    '../database/migrations/002_replace_daerah_data.sql',
  );
  const sql = fs.readFileSync(file, 'utf-8');
  const statements = sql.match(/INSERT INTO daerah[\s\S]*?\);\s*$/gm) ?? [];
  if (statements.length !== 2) {
    throw new Error(
      `Expected 2 INSERT statements in ${file}, found ${statements.length}.`,
    );
  }
  return statements.map((statement) =>
    statement.trim().replace(/;$/, ' ON CONFLICT (kode) DO NOTHING;'),
  );
}

async function backfillPrefix(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `UPDATE daerah SET prefix = 'Provinsi' WHERE level = 'provinsi' AND prefix IS NULL`,
  );
  await queryRunner.query(
    `UPDATE daerah SET prefix = 'Kabupaten' WHERE level = 'kabupaten' AND prefix IS NULL`,
  );
  await queryRunner.query(
    `UPDATE daerah SET prefix = 'Kota' WHERE level = 'kota' AND prefix IS NULL`,
  );
  await queryRunner.query(
    `UPDATE daerah SET prefix = 'Kabupaten Administrasi' WHERE level = 'kabupaten' AND kode = '31.01'`,
  );
  await queryRunner.query(
    `UPDATE daerah SET prefix = 'Kota Administrasi' WHERE level = 'kota' AND kode LIKE '31.7%'`,
  );
}

async function countLevel(
  queryRunner: QueryRunner,
  levels: string[],
): Promise<number> {
  const rows = (await queryRunner.query(
    `SELECT COUNT(*)::text AS count FROM daerah WHERE level::text = ANY($1)`,
    [levels],
  )) as { count: string }[];
  return parseInt(rows[0].count, 10);
}

/**
 * Small, clearly fake DEMO dataset: one fake kurator user, three PROT plus four
 * Sumatera Selatan PROT (Phase 11) with
 * status ARSIP_NASIONAL (publicly visible) and one published event.
 * Every name starts with "DEMO". Fixed ids + orIgnore() keep it idempotent.
 */
async function seedDemoData(
  dataSource: DataSource,
  log: (message: string) => void,
): Promise<void> {
  const now = new Date();

  await dataSource
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      id: DEMO_IDS.user,
      supabase_user_id: DEMO_IDS.supabaseUser,
      email: DEMO_USER_EMAIL,
      full_name: 'DEMO Kurator',
      role: UserRole.KURATOR_DAERAH,
      status: UserStatus.ACTIVE,
      bio: 'DEMO account for local development only. Not a real person.',
    })
    .orIgnore()
    .execute();

  const demoProts = [
    {
      nama: 'DEMO Gobak Sodor',
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.ANAK,
      provinsiKode: '32',
      kabkotaKode: '32.73',
    },
    {
      nama: 'DEMO Egrang',
      jenis: PROTJenis.OLAHRAGA_TRADISIONAL,
      targetUsia: TargetUsia.SEMUA_USIA,
      provinsiKode: '34',
      kabkotaKode: '34.04',
    },
    {
      nama: 'DEMO Congklak',
      jenis: PROTJenis.PERMAINAN_RAKYAT,
      targetUsia: TargetUsia.REMAJA,
      provinsiKode: '34',
      kabkotaKode: '34.71',
    },
  ];
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(PROT)
    .values(
      demoProts.map((prot, index) => ({
        ...prot,
        id: DEMO_IDS.prot[index],
        deskripsi: 'DEMO data for local development only.',
        caraBermain: 'DEMO: no real instructions.',
        nilaiMoral: 'DEMO',
        jumlahPemain: 4,
        status: PROTStatus.ARSIP_NASIONAL,
        created_by: DEMO_IDS.user,
        submitted_at: now,
        verified_at: now,
        published_at: now,
      })),
    )
    .orIgnore()
    .execute();

  // Phase 11: four DEMO PROT in Sumatera Selatan (Jelajah pilot scene). Neutral
  // placeholder text only, no photos; never real cultural content.
  const sumselKabkota = ['16.71', '16.01', '16.10', '16.74'];
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(PROT)
    .values(
      DEMO_IDS.protSumsel.map((id, index) => ({
        id,
        nama: `DEMO PROT Sumsel ${index + 1}`,
        jenis:
          index % 2 === 0
            ? PROTJenis.PERMAINAN_RAKYAT
            : PROTJenis.OLAHRAGA_TRADISIONAL,
        targetUsia: TargetUsia.SEMUA_USIA,
        provinsiKode: '16',
        kabkotaKode: sumselKabkota[index],
        deskripsi: DEMO_SUMSEL_TEXT,
        caraBermain: DEMO_SUMSEL_TEXT,
        nilaiMoral: DEMO_SUMSEL_TEXT,
        jumlahPemain: 4,
        status: PROTStatus.ARSIP_NASIONAL,
        created_by: DEMO_IDS.user,
        submitted_at: now,
        verified_at: now,
        published_at: now,
      })),
    )
    .orIgnore()
    .execute();

  const jawaBarat = await dataSource
    .getRepository(Daerah)
    .findOneByOrFail({ kode: '32' });
  const start = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(Event)
    .values({
      id: DEMO_IDS.event,
      nama: 'DEMO Teras Bermain',
      deskripsi: 'DEMO event for local development only.',
      jenis: EventJenis.TERAS_BERMAIN,
      status: EventStatus.PUBLISHED,
      tanggal_mulai: start,
      tanggal_selesai: new Date(start.getTime() + 3 * 60 * 60 * 1000),
      lokasi: 'DEMO Lokasi',
      daerah_id: jawaBarat.id,
      kuota_peserta: 20,
      created_by: DEMO_IDS.user,
      published_at: now,
    })
    .orIgnore()
    .execute();

  log(
    `[db:setup] DEMO data present: 1 user (${DEMO_USER_EMAIL}), ${demoProts.length + DEMO_IDS.protSumsel.length} PROT (ARSIP_NASIONAL, ${DEMO_IDS.protSumsel.length} in Sumatera Selatan), 1 event (published).`,
  );
}

function parseArgs(argv: string[]): LocalDbSetupOptions {
  const options: LocalDbSetupOptions = {};
  for (const arg of argv) {
    if (arg === '--no-demo') {
      options.demo = false;
    } else if (arg.startsWith('--database=')) {
      options.database = arg.slice('--database='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

if (require.main === module) {
  // Same env files as the app and the migration CLI: .env.local, then .env.
  dotenv.config({ path: ['.env.local', '.env'], quiet: true });
  setupLocalDatabase(parseArgs(process.argv.slice(2))).catch(
    (error: unknown) => {
      console.error(
        `[db:setup] FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    },
  );
}
