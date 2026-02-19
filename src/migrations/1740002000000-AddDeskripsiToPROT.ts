import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeskripsiToPROT1740002000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot
      ADD COLUMN IF NOT EXISTS deskripsi text NULL
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot DROP COLUMN IF EXISTS deskripsi
    `);
    }
}
