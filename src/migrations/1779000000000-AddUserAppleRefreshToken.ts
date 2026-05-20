import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAppleRefreshToken1779000000000 implements MigrationInterface {
  name = 'AddUserAppleRefreshToken1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_refresh_token" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "apple_refresh_token"`,
    );
  }
}
