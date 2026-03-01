import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertBookingTimesToTimestamptz1762000000000 implements MigrationInterface {
  name = 'ConvertBookingTimesToTimestamptz1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.booking_timestamp_tz_backup_20260301 AS
      SELECT
        id,
        "startTime",
        "endTime",
        NOW() AT TIME ZONE 'UTC' AS backed_up_at_utc
      FROM public.booking;
    `);

    await queryRunner.query(`
      ALTER TABLE public.booking
      ALTER COLUMN "startTime" TYPE timestamptz USING ("startTime" AT TIME ZONE 'America/Sao_Paulo'),
      ALTER COLUMN "endTime" TYPE timestamptz USING ("endTime" AT TIME ZONE 'America/Sao_Paulo');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.booking
      ALTER COLUMN "startTime" TYPE timestamp WITHOUT TIME ZONE USING (timezone('America/Sao_Paulo', "startTime")),
      ALTER COLUMN "endTime" TYPE timestamp WITHOUT TIME ZONE USING (timezone('America/Sao_Paulo', "endTime"));
    `);
  }
}
