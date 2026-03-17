import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessagesFeature1763300000000 implements MigrationInterface {
  name = 'AddMessagesFeature1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "senderUserId" uuid NOT NULL,
        "senderName" varchar(120) NOT NULL,
        "senderEmail" varchar(150) NOT NULL,
        "senderApartment" varchar(30),
        "senderBlock" integer,
        "subject" varchar(255) NOT NULL,
        "category" varchar(32) NOT NULL,
        "content" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'unread',
        "readAt" timestamp,
        "adminEmailDeliveryStatus" varchar(32) NOT NULL DEFAULT 'pending',
        "adminEmailProviderMessageId" varchar(128),
        "adminEmailSentAt" timestamp,
        "adminEmailLastError" text,
        "organizationId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_reply" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "messageId" uuid NOT NULL,
        "authorUserId" uuid NOT NULL,
        "authorName" varchar(120) NOT NULL,
        "content" text NOT NULL,
        "sendViaEmail" boolean NOT NULL DEFAULT false,
        "emailDeliveryStatus" varchar(32) NOT NULL DEFAULT 'not_requested',
        "emailProviderMessageId" varchar(128),
        "emailSentAt" timestamp,
        "emailLastError" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_message_reply_message" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_org_created_at"
      ON "message" ("organizationId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_org_status_created_at"
      ON "message" ("organizationId", "status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_reply_message_created_at"
      ON "message_reply" ("messageId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_reply_message_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_org_status_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_org_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_reply"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message"`);
  }
}
