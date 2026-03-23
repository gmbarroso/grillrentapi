import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachments1764100000000 implements MigrationInterface {
  name = 'AddMessageAttachments1764100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "message"
      ADD COLUMN IF NOT EXISTS "attachments" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "message"
      DROP COLUMN IF EXISTS "attachments"
    `);
  }
}
