import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketplace1743000000000 implements MigrationInterface {
  name = 'CreateMarketplace1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE kategori_produk (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        nama       varchar NOT NULL,
        slug       varchar NOT NULL UNIQUE,
        deskripsi  text,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE toko (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nama       varchar NOT NULL,
        slug       varchar NOT NULL UNIQUE,
        deskripsi  text,
        logo_url   varchar,
        alamat     text,
        phone      varchar,
        whatsapp   varchar,
        is_active  boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_toko_user ON toko(user_id)`);

    await queryRunner.query(`
      CREATE TABLE produk (
        id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        toko_id     uuid NOT NULL REFERENCES toko(id) ON DELETE CASCADE,
        kategori_id uuid REFERENCES kategori_produk(id) ON DELETE SET NULL,
        nama        varchar NOT NULL,
        slug        varchar NOT NULL,
        deskripsi   text,
        harga       numeric(15,2) NOT NULL,
        stok        integer NOT NULL DEFAULT 0,
        images      jsonb,
        is_active   boolean NOT NULL DEFAULT true,
        created_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (toko_id, slug)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_produk_toko ON produk(toko_id)`);
    await queryRunner.query(`CREATE INDEX idx_produk_kategori ON produk(kategori_id)`);
    await queryRunner.query(`CREATE INDEX idx_produk_active ON produk(is_active)`);

    await queryRunner.query(`
      CREATE TABLE produk_prot (
        produk_id uuid NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
        prot_id   uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        PRIMARY KEY (produk_id, prot_id)
      )
    `);

    await queryRunner.query(`
      CREATE TYPE order_status AS ENUM (
        'menunggu', 'dikonfirmasi', 'dikirim', 'selesai', 'dibatalkan'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_order (
        id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        buyer_id         uuid NOT NULL REFERENCES users(id),
        toko_id          uuid NOT NULL REFERENCES toko(id),
        status           order_status NOT NULL DEFAULT 'menunggu',
        total_harga      numeric(15,2) NOT NULL,
        shipping_address jsonb NOT NULL,
        catatan          text,
        kurir_pengiriman varchar,
        nomor_resi       varchar,
        created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_buyer ON marketplace_order(buyer_id)`);
    await queryRunner.query(`CREATE INDEX idx_order_toko ON marketplace_order(toko_id)`);
    await queryRunner.query(`CREATE INDEX idx_order_status ON marketplace_order(status)`);

    await queryRunner.query(`
      CREATE TABLE order_item (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id     uuid NOT NULL REFERENCES marketplace_order(id) ON DELETE CASCADE,
        produk_id    uuid NOT NULL REFERENCES produk(id),
        nama_produk  varchar NOT NULL,
        qty          integer NOT NULL,
        harga_satuan numeric(15,2) NOT NULL,
        subtotal     numeric(15,2) NOT NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_item_order ON order_item(order_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_item CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_order CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS produk_prot CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS produk CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS toko CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS kategori_produk CASCADE`);
  }
}
