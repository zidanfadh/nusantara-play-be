import { MigrationInterface, QueryRunner } from 'typeorm';

/** Anything with a query() method: QueryRunner, DataSource, EntityManager. */
interface Queryable {
  query(sql: string): Promise<unknown>;
}

/**
 * Phase 15: rewards ledger (XP and Points), balances, PROT views and Paspor
 * stamps.
 *
 * - reward_ledger: append-only. A trigger refuses UPDATE, DELETE and TRUNCATE;
 *   corrections are new compensating rows. Exception: when the user row is
 *   already gone (ON DELETE CASCADE from users), the cascaded DELETE is
 *   allowed, otherwise deleting an account would be impossible.
 *   `currency` is text + CHECK ('XP', 'POINTS'), not a new enum type.
 * - reward_balances: one row per user, updated in the same transaction as
 *   every ledger insert (RewardsService).
 * - user_prot_views: first view of a PROT per user (PROT_VIEW rule).
 * - user_province_stamps: Paspor stamps.
 *
 * Hand-written (CLAUDE.md "Migration rules"): additive only, IF NOT EXISTS,
 * explicit names identical to the entities in src/modules/rewards/entities/.
 * Depends only on users.id. The old code never reads these tables.
 *
 * synchronize() (local db:setup) cannot create triggers or DESC indexes, so
 * those live in the static installDbObjects(), which up() calls and which
 * src/scripts/db-local-setup.ts also calls after synchronize() (owner
 * decision, Phase 15). It is idempotent.
 */
export class CreateRewardsLedger1795300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reward_ledger (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        currency text NOT NULL,
        amount integer NOT NULL,
        rule_code text NOT NULL,
        source_type text NOT NULL,
        source_id text NULL,
        provinsi_kode text NULL,
        idempotency_key text NOT NULL,
        metadata jsonb NULL,
        available_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reward_ledger" PRIMARY KEY (id),
        CONSTRAINT "CHK_reward_ledger_currency"
          CHECK ("currency" IN ('XP', 'POINTS')),
        CONSTRAINT "FK_reward_ledger_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reward_ledger_idempotency_key" ON reward_ledger (idempotency_key)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reward_ledger_user_id_rule_code" ON reward_ledger (user_id, rule_code)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reward_balances (
        user_id uuid NOT NULL,
        xp_total integer NOT NULL DEFAULT 0,
        points_total integer NOT NULL DEFAULT 0,
        points_available_cache integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reward_balances" PRIMARY KEY (user_id),
        CONSTRAINT "FK_reward_balances_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_prot_views (
        user_id uuid NOT NULL,
        prot_id uuid NOT NULL,
        provinsi_kode text NOT NULL,
        first_viewed_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_prot_views" PRIMARY KEY (user_id, prot_id),
        CONSTRAINT "FK_user_prot_views_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_prot_views_user_id_provinsi_kode" ON user_prot_views (user_id, provinsi_kode)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_province_stamps (
        user_id uuid NOT NULL,
        provinsi_kode text NOT NULL,
        stamped_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_province_stamps" PRIMARY KEY (user_id, provinsi_kode),
        CONSTRAINT "FK_user_province_stamps_user_id" FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    await CreateRewardsLedger1795300000000.installDbObjects(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_reward_ledger_append_only" ON reward_ledger`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_reward_ledger_no_truncate" ON reward_ledger`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS reward_ledger_append_only()`,
    );
    // Dropping the tables also drops their indexes and constraints.
    await queryRunner.query(`DROP TABLE IF EXISTS user_province_stamps`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_prot_views`);
    await queryRunner.query(`DROP TABLE IF EXISTS reward_balances`);
    await queryRunner.query(`DROP TABLE IF EXISTS reward_ledger`);
  }

  /**
   * The objects synchronize() cannot create: the append-only trigger and the
   * (user_id, created_at DESC) index. Idempotent (CREATE OR REPLACE, DROP
   * TRIGGER IF EXISTS + CREATE, CREATE INDEX IF NOT EXISTS). Requires the
   * reward_ledger table. A static method, not a separate export: TypeORM
   * treats every exported function of a migration file as a migration.
   */
  static async installDbObjects(db: Queryable): Promise<void> {
    await db.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reward_ledger_user_id_created_at" ON reward_ledger (user_id, created_at DESC)`,
    );
    await db.query(`
      CREATE OR REPLACE FUNCTION reward_ledger_append_only() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        -- Cascaded delete of an account (users row already gone): allowed.
        -- (Nested IF: OLD does not exist in the statement-level TRUNCATE trigger.)
        IF TG_OP = 'DELETE' THEN
          IF NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
            RETURN OLD;
          END IF;
        END IF;
        RAISE EXCEPTION 'reward_ledger is append-only (% refused); insert a compensating row instead', TG_OP
          USING ERRCODE = 'restrict_violation';
      END;
      $$
    `);
    await db.query(
      `DROP TRIGGER IF EXISTS "TRG_reward_ledger_append_only" ON reward_ledger`,
    );
    await db.query(`
      CREATE TRIGGER "TRG_reward_ledger_append_only"
        BEFORE UPDATE OR DELETE ON reward_ledger
        FOR EACH ROW EXECUTE FUNCTION reward_ledger_append_only()
    `);
    await db.query(
      `DROP TRIGGER IF EXISTS "TRG_reward_ledger_no_truncate" ON reward_ledger`,
    );
    await db.query(`
      CREATE TRIGGER "TRG_reward_ledger_no_truncate"
        BEFORE TRUNCATE ON reward_ledger
        FOR EACH STATEMENT EXECUTE FUNCTION reward_ledger_append_only()
    `);
  }
}
