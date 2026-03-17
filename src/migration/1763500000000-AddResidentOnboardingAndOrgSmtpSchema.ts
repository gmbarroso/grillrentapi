import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResidentOnboardingAndOrgSmtpSchema1763500000000 implements MigrationInterface {
  name = 'AddResidentOnboardingAndOrgSmtpSchema1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pendingEmail" varchar(100)`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMPTZ`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_emailVerificationTokenHash"
      ON "user" ("emailVerificationTokenHash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_organization_pendingEmail"
      ON "user" ("organizationId", "pendingEmail")
    `);

    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpHost" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpPort" integer`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpSecure" boolean`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpUser" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpFrom" varchar(255)`);
    await queryRunner.query(
      `ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordEncrypted" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordIv" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordAuthTag" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordKeyVersion" varchar(64)`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_contact_email_settings_organizationId"
      ON "organization_contact_email_settings" ("organizationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordKeyVersion"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordAuthTag"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordIv"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordEncrypted"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpFrom"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpUser"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpSecure"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpPort"`);
    await queryRunner.query(`ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpHost"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_organization_pendingEmail"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_emailVerificationTokenHash"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "emailVerificationExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "emailVerificationTokenHash"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "pendingEmail"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "mustChangePassword"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "emailVerifiedAt"`);
    await queryRunner.query(`
      UPDATE "user"
      SET "email" = CONCAT('rollback-', "id", '@invalid.local')
      WHERE "email" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`);
  }
}
