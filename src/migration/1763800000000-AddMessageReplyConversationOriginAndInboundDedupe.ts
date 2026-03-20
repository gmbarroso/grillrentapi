import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReplyConversationOriginAndInboundDedupe1763800000000 implements MigrationInterface {
  name = 'AddMessageReplyConversationOriginAndInboundDedupe1763800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "message_reply"
      ADD COLUMN IF NOT EXISTS "originRole" varchar(16) NOT NULL DEFAULT 'admin'
    `);

    await queryRunner.query(`
      ALTER TABLE "message_reply"
      ADD COLUMN IF NOT EXISTS "originChannel" varchar(24) NOT NULL DEFAULT 'in_app'
    `);

    await queryRunner.query(`
      ALTER TABLE "message_reply"
      ADD COLUMN IF NOT EXISTS "externalMessageId" varchar(255)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_reply_message_external_id"
      ON "message_reply" ("messageId", "externalMessageId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_reply_message_external_id"`);
    await queryRunner.query(`ALTER TABLE "message_reply" DROP COLUMN IF EXISTS "externalMessageId"`);
    await queryRunner.query(`ALTER TABLE "message_reply" DROP COLUMN IF EXISTS "originChannel"`);
    await queryRunner.query(`ALTER TABLE "message_reply" DROP COLUMN IF EXISTS "originRole"`);
  }
}
