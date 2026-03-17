import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFieldsToUser1763600000000 implements MigrationInterface {
  name = 'AddPasswordResetFieldsToUser1763600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_passwordResetTokenHash" ON "user" ("passwordResetTokenHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_passwordResetTokenHash"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "passwordResetExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "passwordResetTokenHash"`);
  }
}
