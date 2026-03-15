import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationWhatsappIntegration1763200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_whatsapp_integration" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "provider" varchar(32) NOT NULL DEFAULT 'evolution',
        "baseUrl" text NOT NULL,
        "instanceName" varchar(120) NOT NULL,
        "apiKey" text NOT NULL,
        "whatsappNumber" varchar(40),
        "autoSendNotices" boolean NOT NULL DEFAULT false,
        "status" varchar(24) NOT NULL DEFAULT 'disconnected',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_org_whatsapp_integration_organization'
        ) THEN
          ALTER TABLE "organization_whatsapp_integration"
          ADD CONSTRAINT "UQ_org_whatsapp_integration_organization" UNIQUE ("organizationId");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_whatsapp_group_binding" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "integrationId" uuid NOT NULL,
        "feature" varchar(64) NOT NULL,
        "groupJid" varchar(191) NOT NULL,
        "groupName" varchar(180),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_org_whatsapp_group_binding_org_feature'
        ) THEN
          ALTER TABLE "organization_whatsapp_group_binding"
          ADD CONSTRAINT "UQ_org_whatsapp_group_binding_org_feature" UNIQUE ("organizationId", "feature");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_org_whatsapp_group_binding_integration'
        ) THEN
          ALTER TABLE "organization_whatsapp_group_binding"
          ADD CONSTRAINT "FK_org_whatsapp_group_binding_integration"
            FOREIGN KEY ("integrationId") REFERENCES "organization_whatsapp_integration"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_org_whatsapp_integration_organizationId" ON "organization_whatsapp_integration" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_org_whatsapp_group_binding_organizationId" ON "organization_whatsapp_group_binding" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_org_whatsapp_group_binding_integrationId" ON "organization_whatsapp_group_binding" ("integrationId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_whatsapp_group_binding_integrationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_whatsapp_group_binding_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_whatsapp_integration_organizationId"`);

    await queryRunner.query(`ALTER TABLE "organization_whatsapp_group_binding" DROP CONSTRAINT IF EXISTS "FK_org_whatsapp_group_binding_integration"`);
    await queryRunner.query(`ALTER TABLE "organization_whatsapp_group_binding" DROP CONSTRAINT IF EXISTS "UQ_org_whatsapp_group_binding_org_feature"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_whatsapp_group_binding"`);

    await queryRunner.query(`ALTER TABLE "organization_whatsapp_integration" DROP CONSTRAINT IF EXISTS "UQ_org_whatsapp_integration_organization"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_whatsapp_integration"`);
  }
}
