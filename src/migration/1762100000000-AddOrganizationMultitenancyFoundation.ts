import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationMultitenancyFoundation1762100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "address" text,
        "email" varchar(150),
        "phone" varchar(40),
        "timezone" varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
        "openingTime" varchar(5),
        "closingTime" varchar(5),
        "logoUrl" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_organization_slug'
        ) THEN
          ALTER TABLE "organization" ADD CONSTRAINT "UQ_organization_slug" UNIQUE ("slug");
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "organizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "resource" ADD COLUMN IF NOT EXISTS "organizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "organizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "notice" ADD COLUMN IF NOT EXISTS "organizationId" uuid`);
    await queryRunner.query(`ALTER TABLE "revoked_token" ADD COLUMN IF NOT EXISTS "organizationId" uuid`);

    await queryRunner.query(`
      INSERT INTO "organization" ("id", "name", "slug", "timezone")
      VALUES (
        '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
        'Legacy Default Organization',
        'legacy-default',
        'America/Sao_Paulo'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "user"
      SET "organizationId" = '9dd02335-74fa-487b-99f3-f3e6f9fba2af'
      WHERE "organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "resource"
      SET "organizationId" = '9dd02335-74fa-487b-99f3-f3e6f9fba2af'
      WHERE "organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "booking"
      SET "organizationId" = '9dd02335-74fa-487b-99f3-f3e6f9fba2af'
      WHERE "organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "notice"
      SET "organizationId" = '9dd02335-74fa-487b-99f3-f3e6f9fba2af'
      WHERE "organizationId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "revoked_token"
      SET "organizationId" = '9dd02335-74fa-487b-99f3-f3e6f9fba2af'
      WHERE "organizationId" IS NULL
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_organizationId" ON "user" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_resource_organizationId" ON "resource" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_organizationId" ON "booking" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notice_organizationId" ON "notice" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_revoked_token_organizationId" ON "revoked_token" ("organizationId")`);

    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_email"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_apartment_block"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_user_organization_email'
        ) THEN
          ALTER TABLE "user" ADD CONSTRAINT "UQ_user_organization_email" UNIQUE ("organizationId", "email");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_user_organization_apartment_block'
        ) THEN
          ALTER TABLE "user" ADD CONSTRAINT "UQ_user_organization_apartment_block" UNIQUE ("organizationId", "apartment", "block");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_organization_email"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_organization_apartment_block"`);
    await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_user_email" UNIQUE ("email")`);
    await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_user_apartment_block" UNIQUE ("apartment", "block")`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resource_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notice_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_revoked_token_organizationId"`);

    await queryRunner.query(`ALTER TABLE "revoked_token" DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE "resource" DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "organizationId"`);

    await queryRunner.query(`ALTER TABLE "organization" DROP CONSTRAINT IF EXISTS "UQ_organization_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization"`);
  }
}
