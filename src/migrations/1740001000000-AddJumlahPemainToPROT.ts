import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJumlahPemainToPROT1740001000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot
      ADD COLUMN IF NOT EXISTS jumlah_pemain int NULL
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE prot DROP COLUMN IF EXISTS jumlah_pemain
    `);
    }
}
