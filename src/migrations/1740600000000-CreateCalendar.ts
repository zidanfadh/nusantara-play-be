import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCalendar1740600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum types
        await queryRunner.query(`
      CREATE TYPE "calendar_item_type" AS ENUM ('important_date', 'personal_schedule');
    `);

        await queryRunner.query(`
      CREATE TYPE "calendar_item_visibility" AS ENUM ('public', 'internal', 'private');
    `);

        await queryRunner.query(`
      CREATE TYPE "calendar_invite_status" AS ENUM ('pending', 'accepted', 'declined');
    `);

        // Create calendar_items table
        await queryRunner.query(`
      CREATE TABLE "calendar_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text,
        "type" "calendar_item_type" NOT NULL,
        "visibility" "calendar_item_visibility" NOT NULL DEFAULT 'public',
        "start_date" timestamp NOT NULL,
        "end_date" timestamp,
        "all_day" boolean NOT NULL DEFAULT true,
        "color" varchar(20),
        "daerah_id" uuid,
        "event_id" uuid,
        "created_by" uuid NOT NULL,
        "updated_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_calendar_items_daerah" FOREIGN KEY ("daerah_id") REFERENCES "daerah"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_calendar_items_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_calendar_items_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_calendar_items_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_calendar_items_event" UNIQUE ("event_id")
      );
    `);

        // Create indexes for calendar_items
        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_items_start_date_visibility"
        ON "calendar_items" ("start_date", "visibility");
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_items_created_by"
        ON "calendar_items" ("created_by");
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_items_daerah_id"
        ON "calendar_items" ("daerah_id");
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_items_type"
        ON "calendar_items" ("type");
    `);

        // Create calendar_invites table
        await queryRunner.query(`
      CREATE TABLE "calendar_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "calendar_item_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "calendar_invite_status" NOT NULL DEFAULT 'pending',
        "invited_by" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_calendar_invites_item" FOREIGN KEY ("calendar_item_id") REFERENCES "calendar_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_calendar_invites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_calendar_invites_invited_by" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_calendar_invites_item_user" UNIQUE ("calendar_item_id", "user_id")
      );
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_invites_user_id"
        ON "calendar_invites" ("user_id");
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_calendar_invites_calendar_item_id"
        ON "calendar_invites" ("calendar_item_id");
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "calendar_invites";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "calendar_items";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "calendar_invite_status";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "calendar_item_visibility";`);
        await queryRunner.query(`DROP TYPE IF EXISTS "calendar_item_type";`);
    }
}
