import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoticeWhatsappInboundEvent1763700000000 implements MigrationInterface {
  name = 'AddNoticeWhatsappInboundEvent1763700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notice_whatsapp_inbound_event" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "providerEvent" varchar(64),
        "providerMessageId" varchar(191) NOT NULL,
        "groupJid" varchar(191) NOT NULL,
        "senderJid" varchar(191),
        "senderName" varchar(180),
        "messageText" text,
        "messageTimestamp" timestamp,
        "processedAsNotice" boolean NOT NULL DEFAULT false,
        "noticeId" uuid,
        "ignoredReason" varchar(160),
        "rawPayload" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_notice_whatsapp_inbound_event_org_msg'
        ) THEN
          ALTER TABLE "notice_whatsapp_inbound_event"
          ADD CONSTRAINT "UQ_notice_whatsapp_inbound_event_org_msg" UNIQUE ("organizationId", "providerMessageId");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_notice_whatsapp_inbound_event_notice'
        ) THEN
          ALTER TABLE "notice_whatsapp_inbound_event"
          ADD CONSTRAINT "FK_notice_whatsapp_inbound_event_notice"
            FOREIGN KEY ("noticeId") REFERENCES "notice"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notice_whatsapp_inbound_event_org_created"
      ON "notice_whatsapp_inbound_event" ("organizationId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notice_whatsapp_inbound_event_provider_message_id"
      ON "notice_whatsapp_inbound_event" ("providerMessageId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notice_whatsapp_inbound_event_provider_message_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notice_whatsapp_inbound_event_org_created"`);
    await queryRunner.query(
      `ALTER TABLE "notice_whatsapp_inbound_event" DROP CONSTRAINT IF EXISTS "FK_notice_whatsapp_inbound_event_notice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notice_whatsapp_inbound_event" DROP CONSTRAINT IF EXISTS "UQ_notice_whatsapp_inbound_event_org_msg"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notice_whatsapp_inbound_event"`);
  }
}
