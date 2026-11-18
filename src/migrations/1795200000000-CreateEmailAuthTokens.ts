import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 09: email verification and password reset.
 *
 * - auth_tokens: one-time email tokens (only the SHA-256 hash is stored).
 *   `type` is text + CHECK, not a new enum type.
 * - email_verifications: verified email of accounts WITHOUT user_credentials
 *   (Supabase-only now, Google-only from Phase 10). Accounts with a password
 *   use user_credentials.email_verified_at (Phase 07 column).
 *
 * Hand-written (CLAUDE.md "Migration rules"): additive only, IF NOT EXISTS,
 * explicit constraint and index names identical to the entities
 * (auth-token.entity.ts, email-verification.entity.ts). Depends only on
 * users.id. The old code never reads these tables, so running the migration
 * before the new code is safe.
 */
export class CreateEmailAuthTokens1795200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        type text NOT NULL,
        token_hash character(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        requested_ip inet NULL,
        CONSTRAINT "PK_auth_tokens" PRIMARY KEY (id),
        CONSTRAINT "CHK_auth_tokens_type"
          CHECK ("type" IN ('email_verification', 'password_reset')),
        CONSTRAINT "FK_auth_tokens_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auth_tokens_token_hash" ON auth_tokens (token_hash)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_tokens_user_id_type" ON auth_tokens (user_id, type)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        user_id uuid NOT NULL,
        method text NOT NULL,
        verified_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verifications" PRIMARY KEY (user_id),
        CONSTRAINT "CHK_email_verifications_method"
          CHECK ("method" IN ('email_link', 'google')),
        CONSTRAINT "FK_email_verifications_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the tables also drops their indexes and constraints.
    await queryRunner.query(`DROP TABLE IF EXISTS email_verifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_tokens`);
  }
}
