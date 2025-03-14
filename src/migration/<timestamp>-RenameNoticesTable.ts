import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameNoticesTable<Timestamp> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('notices', 'notice');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('notice', 'notices');
  }
}
