import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationBusinessHours1763900000000 implements MigrationInterface {
  name = 'AddOrganizationBusinessHours1763900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      ADD COLUMN IF NOT EXISTS "businessHours" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      DROP COLUMN IF EXISTS "businessHours"
    `);
  }
}
