import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUuidExtensions1762050000000 implements MigrationInterface {
  name = 'EnableUuidExtensions1762050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep extensions to avoid breaking existing objects relying on uuid generation functions.
    await queryRunner.query(`SELECT 1`);
  }
}
