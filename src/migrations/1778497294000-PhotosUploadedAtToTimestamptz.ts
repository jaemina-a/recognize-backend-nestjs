import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhotosUploadedAtToTimestamptz1778497294000 implements MigrationInterface {
  name = 'PhotosUploadedAtToTimestamptz1778497294000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // USING 절로 기존 TIMESTAMP(naive) 값을 UTC 기준 TIMESTAMPTZ로 재해석
    await queryRunner.query(
      `ALTER TABLE "photos"
       ALTER COLUMN "uploaded_at" TYPE TIMESTAMP WITH TIME ZONE
       USING "uploaded_at" AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: TIMESTAMPTZ → TIMESTAMP(naive, UTC 기준)
    await queryRunner.query(
      `ALTER TABLE "photos"
       ALTER COLUMN "uploaded_at" TYPE TIMESTAMP WITHOUT TIME ZONE
       USING "uploaded_at" AT TIME ZONE 'UTC'`,
    );
  }
}
