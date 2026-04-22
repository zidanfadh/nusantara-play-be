import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNftCatalog1776051967000 implements MigrationInterface {
  name = 'CreateNftCatalog1776051967000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE nft_catalog_status AS ENUM ('DRAFT', 'PUBLISHED')
    `);

    await queryRunner.query(`
      CREATE TABLE nft_catalog (
        id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        nama               varchar NOT NULL,
        slug               varchar NOT NULL UNIQUE,
        deskripsi          text,
        about              text,
        image_url          text,
        gallery_urls       jsonb,
        blockchain_network varchar NOT NULL,
        contract_address   varchar NOT NULL,
        token_id           varchar NOT NULL,
        token_standard     varchar,
        metadata_uri       text,
        marketplace_name   varchar,
        marketplace_url    text,
        external_url       text,
        prot_id            uuid REFERENCES prot(id) ON DELETE SET NULL,
        status             nft_catalog_status NOT NULL DEFAULT 'DRAFT',
        is_active          boolean NOT NULL DEFAULT true,
        created_by         uuid NOT NULL REFERENCES users(id),
        updated_by         uuid REFERENCES users(id),
        published_at       timestamp,
        created_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_nft_catalog_blockchain_identity UNIQUE (
          blockchain_network,
          contract_address,
          token_id
        )
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_nft_catalog_status ON nft_catalog(status)`);
    await queryRunner.query(`CREATE INDEX idx_nft_catalog_active ON nft_catalog(is_active)`);
    await queryRunner.query(`
      CREATE INDEX idx_nft_catalog_blockchain_network ON nft_catalog(blockchain_network)
    `);
    await queryRunner.query(`CREATE INDEX idx_nft_catalog_prot ON nft_catalog(prot_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS nft_catalog CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS nft_catalog_status`);
  }
}
