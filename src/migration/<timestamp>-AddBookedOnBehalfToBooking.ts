import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBookedOnBehalfToBooking<Timestamp> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'booking',
      new TableColumn({
        name: 'bookedOnBehalf',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('booking', 'bookedOnBehalf');
  }
}
