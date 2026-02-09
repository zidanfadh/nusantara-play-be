import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPROTVerifikasi1738827000000 implements MigrationInterface {
  name = 'AddPROTVerifikasi1738827000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create prot_status enum
    await queryRunner.query(`
      CREATE TYPE prot_status AS ENUM (
        'DRAFT',
        'DIKURASI',
        'REVISI',
        'DIVERIFIKASI',
        'ARSIP_NASIONAL'
      )
    `);

    // 2. Add status and ownership columns to prot table
    await queryRunner.query(`
      ALTER TABLE prot
        ADD COLUMN status prot_status NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN created_by uuid NOT NULL,
        ADD COLUMN verified_by uuid,
        ADD COLUMN published_by uuid,
        ADD COLUMN submitted_at timestamp,
        ADD COLUMN verified_at timestamp,
        ADD COLUMN published_at timestamp
    `);

    // 3. Add foreign keys to users table
    await queryRunner.query(`
      ALTER TABLE prot
        ADD CONSTRAINT fk_prot_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_prot_verified_by
          FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_prot_published_by
          FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
    `);

    // 4. Add indexes on prot table
    await queryRunner.query(`
      CREATE INDEX idx_prot_status ON prot(status);
      CREATE INDEX idx_prot_created_by ON prot(created_by);
      CREATE INDEX idx_prot_verified_by ON prot(verified_by);
    `);

    // 5. Create verifikasi_status enum
    await queryRunner.query(`
      CREATE TYPE verifikasi_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'REVISION_NEEDED'
      )
    `);

    // 6. Create verifikasi table
    await queryRunner.query(`
      CREATE TABLE verifikasi (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prot_id uuid NOT NULL REFERENCES prot(id) ON DELETE CASCADE,
        pakar_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status verifikasi_status NOT NULL DEFAULT 'PENDING',
        catatan text,
        saran_perbaikan text,
        dokumen_pendukung jsonb,
        verified_at timestamp,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Add indexes on verifikasi table
    await queryRunner.query(`
      CREATE INDEX idx_verifikasi_prot_id ON verifikasi(prot_id);
      CREATE INDEX idx_verifikasi_pakar_id ON verifikasi(pakar_id);
      CREATE INDEX idx_verifikasi_status ON verifikasi(status);
      CREATE INDEX idx_verifikasi_created_at ON verifikasi(created_at DESC);
    `);

    // 8. Create verifikasi_queue table
    await queryRunner.query(`
      CREATE TABLE verifikasi_queue (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        prot_id uuid NOT NULL UNIQUE REFERENCES prot(id) ON DELETE CASCADE,
        assigned_pakar_id uuid REFERENCES users(id) ON DELETE SET NULL,
        priority integer NOT NULL DEFAULT 0,
        assigned_at timestamp,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Add indexes on verifikasi_queue table
    await queryRunner.query(`
      CREATE INDEX idx_verifikasi_queue_prot_id ON verifikasi_queue(prot_id);
      CREATE INDEX idx_verifikasi_queue_assigned_pakar ON verifikasi_queue(assigned_pakar_id);
      CREATE INDEX idx_verifikasi_queue_priority ON verifikasi_queue(priority DESC, created_at ASC);
    `);

    // 10. Set default created_by for existing PROT records (use first admin or create placeholder)
    await queryRunner.query(`
      DO $$
      DECLARE
        admin_id uuid;
      BEGIN
        -- Get first admin_kpoti user
        SELECT id INTO admin_id FROM users WHERE role = 'admin_kpoti' LIMIT 1;

        -- If no admin exists, use first user
        IF admin_id IS NULL THEN
          SELECT id INTO admin_id FROM users LIMIT 1;
        END IF;

        -- Update existing PROT records
        IF admin_id IS NOT NULL THEN
          UPDATE prot SET created_by = admin_id WHERE created_by IS NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables and enums in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS verifikasi_queue CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS verifikasi CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS verifikasi_status`);

    await queryRunner.query(`
      ALTER TABLE prot
        DROP CONSTRAINT IF EXISTS fk_prot_created_by,
        DROP CONSTRAINT IF EXISTS fk_prot_verified_by,
        DROP CONSTRAINT IF EXISTS fk_prot_published_by,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS created_by,
        DROP COLUMN IF EXISTS verified_by,
        DROP COLUMN IF EXISTS published_by,
        DROP COLUMN IF EXISTS submitted_at,
        DROP COLUMN IF EXISTS verified_at,
        DROP COLUMN IF EXISTS published_at
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS prot_status`);
  }
}
