import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceUniqueInboundExternalMessageId1763810000000 implements MigrationInterface {
  name = 'EnforceUniqueInboundExternalMessageId1763810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_reply_message_external_id"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_message_reply_message_external_id"
      ON "message_reply" ("messageId", "externalMessageId")
      WHERE "externalMessageId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_message_reply_message_external_id"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_reply_message_external_id"
      ON "message_reply" ("messageId", "externalMessageId")
    `);
  }
}
