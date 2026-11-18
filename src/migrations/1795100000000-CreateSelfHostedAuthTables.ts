import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 07: foundation of the self-hosted auth.
 *
 * - users.supabase_user_id becomes nullable (explicitly allowed by Phase 07;
 *   its unique constraint stays, whatever its name is).
 * - New tables user_credentials, refresh_tokens, auth_identities.
 *
 * Hand-written (see CLAUDE.md "Migration rules"): IF NOT EXISTS everywhere,
 * no dependency on existing enum types or constraint names. All new
 * constraint and index names are explicit and identical to the entities
 * (src/modules/auth-core/entities/), so a migrated database and a local
 * synchronize()d one have the same schema. password_algo is text + CHECK,
 * not a new enum type. Ids use uuid_generate_v4() like the other
 * TypeORM-generated uuid columns.
 *
 * Safe to run before the old backend code: the old code never writes NULL
 * into supabase_user_id and never reads the new tables.
 */
export class CreateSelfHostedAuthTables1795100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN supabase_user_id DROP NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        user_id uuid NOT NULL,
        password_hash text NOT NULL,
        password_algo text NOT NULL,
        email_verified_at timestamptz NULL,
        failed_login_count integer NOT NULL DEFAULT 0,
        locked_until timestamptz NULL,
        password_changed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_credentials" PRIMARY KEY (user_id),
        CONSTRAINT "CHK_user_credentials_password_algo"
          CHECK ("password_algo" IN ('argon2id', 'bcrypt')),
        CONSTRAINT "FK_user_credentials_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        family_id uuid NOT NULL,
        token_hash character(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        revoked_reason text NULL,
        replaced_by_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        user_agent text NULL,
        ip inet NULL,
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY (id),
        CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refresh_tokens_token_hash" ON refresh_tokens (token_hash)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family_id" ON refresh_tokens (family_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON refresh_tokens (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_identities (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        provider text NOT NULL,
        provider_user_id text NOT NULL,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_identities" PRIMARY KEY (id),
        CONSTRAINT "FK_auth_identities_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auth_identities_provider_user" ON auth_identities (provider, provider_user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_identities_user_id" ON auth_identities (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the tables also drops their indexes and constraints.
    await queryRunner.query(`DROP TABLE IF EXISTS auth_identities`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_credentials`);

    // Restore NOT NULL only when no user without a Supabase id exists;
    // otherwise keep the column nullable instead of failing or deleting
    // users (the old code works with a nullable column).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM users WHERE supabase_user_id IS NULL) THEN
          RAISE NOTICE 'users.supabase_user_id kept nullable: rows without a Supabase id exist';
        ELSE
          ALTER TABLE users ALTER COLUMN supabase_user_id SET NOT NULL;
        END IF;
      END
      $$
    `);
  }
}
