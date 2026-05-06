import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1776762874586 implements MigrationInterface {
  name = 'InitSchema1776762874586';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "nickname" character varying(50) NOT NULL, "email" character varying, "profile_image" character varying, "social_provider" character varying(20) NOT NULL, "social_id" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_ad02a1be8707004cb805a4b5023" UNIQUE ("nickname"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_24ed31edd4e42499a687467fdc4" UNIQUE ("social_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "room_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "room_id" uuid NOT NULL, "user_id" uuid NOT NULL, "color" character varying(7) NOT NULL, "score" integer NOT NULL DEFAULT '0', "joined_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "UQ_d4ea360161fd5ff21a94ae9d8a6" UNIQUE ("room_id", "user_id"), CONSTRAINT "PK_4493fab0433f741b7cf842e6038" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "invite_code" character varying(8) NOT NULL, "owner_id" uuid NOT NULL, "max_members" integer NOT NULL DEFAULT '4', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_d92dfd1fbc0de7ad349a18bc066" UNIQUE ("invite_code"), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "room_id" uuid NOT NULL, "uploader_id" uuid NOT NULL, "photo_url" character varying NOT NULL, "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "PK_5220c45b8e32d49d767b9b3d725" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "room_id" uuid, "type" character varying(20) NOT NULL DEFAULT 'group', "last_message_id" uuid, "last_message_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c69082bd83bffeb71b0f455bd59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_da2e1b29c48f82fa76b3dbb962" ON "chat_rooms" ("room_id", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "chat_room_id" uuid NOT NULL, "sender_id" uuid, "type" character varying(20) NOT NULL DEFAULT 'text', "content" text NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "client_id" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_34275c9a7ab25a6fc7749099db" ON "chat_messages" ("chat_room_id", "client_id") WHERE "client_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eb032fdf515347a034de2e8a8c" ON "chat_messages" ("chat_room_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_reads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "chat_room_id" uuid NOT NULL, "user_id" uuid NOT NULL, "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "last_read_id" uuid, CONSTRAINT "UQ_87c143e41258b8eaae0b84140e6" UNIQUE ("chat_room_id", "user_id"), CONSTRAINT "PK_e6ff4690c4391df4842a0622cbe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_members" ADD CONSTRAINT "FK_e6cf45f179a524427ddf8bacd8e" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_members" ADD CONSTRAINT "FK_b2d15baf5b46ed9659bd71fbb43" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD CONSTRAINT "FK_9f38c339cb7a6e33b02f9d2c743" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_7f7c4c84fa4db7bfca01038d13b" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_afc41ed8d80de3a64f9c958f76a" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_rooms" ADD CONSTRAINT "FK_3f26d3daf7f285f061ba377339b" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_3217ec6230770d4d2c826fc0380" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_reads" ADD CONSTRAINT "FK_515dc76b03e77dbeed230b58989" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_reads" ADD CONSTRAINT "FK_e371b4cda152da0d3eafac5b1f1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_reads" ADD CONSTRAINT "FK_22745374e39e413b35b72feedca" FOREIGN KEY ("last_read_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_reads" DROP CONSTRAINT "FK_22745374e39e413b35b72feedca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_reads" DROP CONSTRAINT "FK_e371b4cda152da0d3eafac5b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_reads" DROP CONSTRAINT "FK_515dc76b03e77dbeed230b58989"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_3217ec6230770d4d2c826fc0380"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_rooms" DROP CONSTRAINT "FK_3f26d3daf7f285f061ba377339b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_afc41ed8d80de3a64f9c958f76a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_7f7c4c84fa4db7bfca01038d13b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" DROP CONSTRAINT "FK_9f38c339cb7a6e33b02f9d2c743"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_members" DROP CONSTRAINT "FK_b2d15baf5b46ed9659bd71fbb43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_members" DROP CONSTRAINT "FK_e6cf45f179a524427ddf8bacd8e"`,
    );
    await queryRunner.query(`DROP TABLE "chat_reads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eb032fdf515347a034de2e8a8c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_34275c9a7ab25a6fc7749099db"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da2e1b29c48f82fa76b3dbb962"`,
    );
    await queryRunner.query(`DROP TABLE "chat_rooms"`);
    await queryRunner.query(`DROP TABLE "photos"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "room_members"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
