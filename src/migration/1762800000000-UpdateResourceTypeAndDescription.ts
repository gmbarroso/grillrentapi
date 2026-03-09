import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateResourceTypeAndDescription1762800000000 implements MigrationInterface {
  name = 'UpdateResourceTypeAndDescription1762800000000';
  private readonly backupTableName = 'resource_type_migration_backup_1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${this.backupTableName}" (
        "resourceId" uuid PRIMARY KEY,
        "previousType" character varying(20) NOT NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "${this.backupTableName}" ("resourceId", "previousType")
      SELECT "id", "type"
      FROM "resource"
      WHERE "type" IN ('grill', 'tennis')
      ON CONFLICT ("resourceId") DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE "resource" ADD COLUMN IF NOT EXISTS "description" character varying(160)`);
    await queryRunner.query(`
      UPDATE "resource" AS r
      SET "type" = 'daily'
      FROM "${this.backupTableName}" AS b
      WHERE r."id" = b."resourceId" AND b."previousType" = 'grill'
    `);
    await queryRunner.query(`
      UPDATE "resource" AS r
      SET "type" = 'hourly'
      FROM "${this.backupTableName}" AS b
      WHERE r."id" = b."resourceId" AND b."previousType" = 'tennis'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "resource" AS r
      SET "type" = b."previousType"
      FROM "${this.backupTableName}" AS b
      WHERE r."id" = b."resourceId"
    `);
    await queryRunner.query(`ALTER TABLE "resource" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${this.backupTableName}"`);
  }
}
