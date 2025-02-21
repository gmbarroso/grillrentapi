import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBlockToUsersxxxxxx implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('user', new TableColumn({
      name: 'block',
      type: 'int',
      isNullable: false,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user', 'block');
  }
}
