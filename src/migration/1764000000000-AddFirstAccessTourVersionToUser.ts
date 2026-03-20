import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstAccessTourVersionToUser1764000000000 implements MigrationInterface {
  name = 'AddFirstAccessTourVersionToUser1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "firstAccessTourVersionCompleted" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "firstAccessTourVersionCompleted"
    `);
  }
}
