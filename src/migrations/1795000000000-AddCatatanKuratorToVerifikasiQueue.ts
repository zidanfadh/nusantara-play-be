import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 06 (B7): stores the kurator's optional note from
 * POST /prot/:id/submit-kurasi on the queue entry, so the pakar sees it.
 *
 * Hand-written and additive only (see CLAUDE.md "Migration rules"): one
 * nullable text column, IF NOT EXISTS, no dependency on existing enum types
 * or constraint names. Must run on production BEFORE the Phase 06 backend
 * starts, because the VerifikasiQueue entity selects this column.
 */
export class AddCatatanKuratorToVerifikasiQueue1795000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE verifikasi_queue
      ADD COLUMN IF NOT EXISTS catatan_kurator text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE verifikasi_queue DROP COLUMN IF EXISTS catatan_kurator
    `);
  }
}
