import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationSidebarNameVisibility1764300000000 implements MigrationInterface {
  name = 'AddOrganizationSidebarNameVisibility1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      ADD COLUMN IF NOT EXISTS "showNameInSidebar" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      DROP COLUMN IF EXISTS "showNameInSidebar"
    `);
  }
}
