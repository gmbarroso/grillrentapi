import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveOrganizationSmtpSettings1764200000000 implements MigrationInterface {
  name = 'RemoveOrganizationSmtpSettings1764200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordKeyVersion"',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordAuthTag"',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordIv"',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpAppPasswordEncrypted"',
    );
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpFrom"');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpUser"');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpSecure"');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpPort"');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" DROP COLUMN IF EXISTS "smtpHost"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpHost" varchar(255)');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpPort" integer');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpSecure" boolean');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpUser" varchar(255)');
    await queryRunner.query('ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpFrom" varchar(255)');
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordEncrypted" text',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordIv" varchar(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordAuthTag" varchar(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "organization_contact_email_settings" ADD COLUMN IF NOT EXISTS "smtpAppPasswordKeyVersion" varchar(64)',
    );
  }
}
