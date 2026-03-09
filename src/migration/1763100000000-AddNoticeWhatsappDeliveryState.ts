import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoticeWhatsappDeliveryState1763100000000 implements MigrationInterface {
  name = 'AddNoticeWhatsappDeliveryState1763100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappDeliveryStatus" varchar(32) NOT NULL DEFAULT 'not_requested'
    `);

    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappAttemptCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappLastAttemptAt" timestamp
    `);

    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappSentAt" timestamp
    `);

    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappProviderMessageId" varchar(128)
    `);

    await queryRunner.query(`
      ALTER TABLE "notice"
      ADD COLUMN IF NOT EXISTS "whatsappLastError" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappLastError"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappProviderMessageId"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappSentAt"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappLastAttemptAt"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappAttemptCount"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN IF EXISTS "whatsappDeliveryStatus"`);
  }
}
