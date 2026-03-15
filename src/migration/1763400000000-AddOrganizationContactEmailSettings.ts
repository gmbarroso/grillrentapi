import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationContactEmailSettings1763400000000 implements MigrationInterface {
  name = 'AddOrganizationContactEmailSettings1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_contact_email_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "deliveryMode" varchar(32) NOT NULL DEFAULT 'in_app_only',
        "recipientEmails" text[] NOT NULL DEFAULT '{}',
        "fromName" varchar(120),
        "fromEmail" varchar(150),
        "replyToMode" varchar(24) NOT NULL DEFAULT 'resident_email',
        "customReplyTo" varchar(150),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_org_contact_email_settings_organization'
        ) THEN
          ALTER TABLE "organization_contact_email_settings"
          ADD CONSTRAINT "UQ_org_contact_email_settings_organization" UNIQUE ("organizationId");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_contact_email_settings_organizationId"
      ON "organization_contact_email_settings" ("organizationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_contact_email_settings_organizationId"`);
    await queryRunner.query(`
      ALTER TABLE "organization_contact_email_settings"
      DROP CONSTRAINT IF EXISTS "UQ_org_contact_email_settings_organization"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_contact_email_settings"`);
  }
}
