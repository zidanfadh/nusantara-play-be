import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockchainProof1742000000000 implements MigrationInterface {
  name = 'AddBlockchainProof1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE blockchain_proof (
        id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        verifikasi_id      uuid NOT NULL REFERENCES verifikasi(id) ON DELETE CASCADE,
        prot_id            uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        version            integer NOT NULL,
        data_hash          text NOT NULL,
        tx_hash            text,
        block_number       bigint,
        blockchain_network text NOT NULL DEFAULT 'polygon-mumbai',
        status             text NOT NULL DEFAULT 'pending',
        retry_count        integer NOT NULL DEFAULT 0,
        last_error         text,
        anchored_at        timestamp,
        created_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (prot_id, version)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_blockchain_proof_verifikasi ON blockchain_proof(verifikasi_id);
      CREATE INDEX idx_blockchain_proof_prot       ON blockchain_proof(prot_id);
      CREATE INDEX idx_blockchain_proof_status     ON blockchain_proof(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS blockchain_proof CASCADE`);
  }
}
