import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateResourceTypeAndDescription1762800000000 implements MigrationInterface {
  name = 'UpdateResourceTypeAndDescription1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resource" ADD COLUMN IF NOT EXISTS "description" character varying(160)`);
    await queryRunner.query(`UPDATE "resource" SET "type" = 'daily' WHERE "type" = 'grill'`);
    await queryRunner.query(`UPDATE "resource" SET "type" = 'hourly' WHERE "type" = 'tennis'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "resource" SET "type" = 'grill' WHERE "type" = 'daily'`);
    await queryRunner.query(`UPDATE "resource" SET "type" = 'tennis' WHERE "type" = 'hourly'`);
    await queryRunner.query(`ALTER TABLE "resource" DROP COLUMN IF EXISTS "description"`);
  }
}
