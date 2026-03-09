import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoticeReadState1762900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notice_read_state" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "lastSeenNoticesAt" timestamp NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_notice_read_state_user_org'
        ) THEN
          ALTER TABLE "notice_read_state"
          ADD CONSTRAINT "UQ_notice_read_state_user_org" UNIQUE ("userId", "organizationId");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notice_read_state_org_user"
      ON "notice_read_state" ("organizationId", "userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notice_org_created_at"
      ON "notice" ("organizationId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notice_org_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notice_read_state_org_user"`);
    await queryRunner.query(`ALTER TABLE "notice_read_state" DROP CONSTRAINT IF EXISTS "UQ_notice_read_state_user_org"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notice_read_state"`);
  }
}
