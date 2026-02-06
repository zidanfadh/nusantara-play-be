import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePROT1738825200000 implements MigrationInterface {
  name = 'CreatePROT1738825200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for PROT_JENIS
    await queryRunner.query(`
      CREATE TYPE "prot_jenis_enum" AS ENUM (
        'PERMAINAN_RAKYAT',
        'OLAHRAGA_TRADISIONAL'
      );
    `);

    // Create enum for TARGET_USIA
    await queryRunner.query(`
      CREATE TYPE "target_usia_enum" AS ENUM (
        'ANAK',
        'REMAJA',
        'DEWASA',
        'SEMUA_USIA'
      );
    `);

    // Create PROT table
    await queryRunner.query(`
      CREATE TABLE "prot" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "nama" varchar NOT NULL,
        "jenis" "prot_jenis_enum" NOT NULL,
        "statusAsalUsul" text,
        "provinsiKode" varchar,
        "kabkotaKode" varchar,
        "kecamatanKode" varchar,
        "desaKode" varchar,
        "alamatLengkap" varchar,
        "caraBermain" text,
        "nilaiMoral" text,
        "targetUsia" "target_usia_enum" NOT NULL,
        "peralatan" jsonb,
        "fotoKegiatan" jsonb,
        "videoKegiatan" jsonb,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on frequently queried columns
    await queryRunner.query(`
      CREATE INDEX "idx_prot_jenis" ON "prot" ("jenis");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prot_target_usia" ON "prot" ("targetUsia");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prot_provinsi_kode" ON "prot" ("provinsiKode");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prot_kabkota_kode" ON "prot" ("kabkotaKode");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prot_kecamatan_kode" ON "prot" ("kecamatanKode");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prot_desa_kode" ON "prot" ("desaKode");
    `);

    // Create GIN index for jsonb fields
    await queryRunner.query(`
      CREATE INDEX "idx_prot_peralatin" ON "prot" USING gin ("peralatan");
    `);

    // Create GIN index for searching in nama
    await queryRunner.query(`
      CREATE INDEX "idx_prot_nama_gin" ON "prot" USING gin (to_tsvector('simple', "nama"));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop PROT table
    await queryRunner.query(`DROP TABLE IF EXISTS "prot";`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "target_usia_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "prot_jenis_enum";`);
  }
}
