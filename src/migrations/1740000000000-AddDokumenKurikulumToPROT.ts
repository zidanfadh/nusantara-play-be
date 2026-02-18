import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDokumenKurikulumToPROT1740000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot
      ADD COLUMN IF NOT EXISTS dokumen_kurikulum jsonb NOT NULL DEFAULT '[]'
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot DROP COLUMN IF EXISTS dokumen_kurikulum
    `);
    }
}
