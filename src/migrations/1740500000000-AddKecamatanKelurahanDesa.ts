import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKecamatanKelurahanDesa1740500000000 implements MigrationInterface {
  name = 'AddKecamatanKelurahanDesa1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend daerah_level enum with new values
    await queryRunner.query(
      `ALTER TYPE daerah_level ADD VALUE IF NOT EXISTS 'kecamatan';`,
    );
    await queryRunner.query(
      `ALTER TYPE daerah_level ADD VALUE IF NOT EXISTS 'kelurahan';`,
    );
    await queryRunner.query(
      `ALTER TYPE daerah_level ADD VALUE IF NOT EXISTS 'desa';`,
    );

    // 2. Widen kode column (kelurahan codes are 13 chars, e.g. "11.01.01.2001")
    await queryRunner.query(
      `ALTER TABLE daerah ALTER COLUMN kode TYPE VARCHAR(15);`,
    );

    // 3. Add prefix column for administrative variant names
    await queryRunner.query(
      `ALTER TABLE daerah ADD COLUMN IF NOT EXISTS prefix VARCHAR(50);`,
    );

    // 4. Add indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_daerah_prefix ON daerah(prefix);`,
    );

    // 5. Backfill prefix for existing provinsi/kota/kabupaten data
    await queryRunner.query(
      `UPDATE daerah SET prefix = 'Provinsi' WHERE level = 'provinsi' AND prefix IS NULL;`,
    );
    await queryRunner.query(
      `UPDATE daerah SET prefix = 'Kabupaten' WHERE level = 'kabupaten' AND prefix IS NULL;`,
    );
    await queryRunner.query(
      `UPDATE daerah SET prefix = 'Kota' WHERE level = 'kota' AND prefix IS NULL;`,
    );

    // Special cases for DKI Jakarta
    await queryRunner.query(
      `UPDATE daerah SET prefix = 'Kabupaten Administrasi' WHERE level = 'kabupaten' AND kode = '31.01';`,
    );
    await queryRunner.query(
      `UPDATE daerah SET prefix = 'Kota Administrasi' WHERE level = 'kota' AND kode LIKE '31.7%';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all kecamatan/kelurahan/desa data first
    await queryRunner.query(
      `DELETE FROM daerah WHERE level IN ('kecamatan', 'kelurahan', 'desa');`,
    );

    // Drop prefix column
    await queryRunner.query(
      `ALTER TABLE daerah DROP COLUMN IF EXISTS prefix;`,
    );

    // Drop prefix index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_daerah_prefix;`);

    // Revert kode column width
    await queryRunner.query(
      `ALTER TABLE daerah ALTER COLUMN kode TYPE VARCHAR(10);`,
    );

    // Note: PostgreSQL does not support removing individual enum values.
    // To fully revert the enum, you would need to recreate it.
    // This is left as-is for safety.
  }
}
