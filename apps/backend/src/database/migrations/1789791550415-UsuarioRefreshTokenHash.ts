import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioRefreshTokenHash1789791550415 implements MigrationInterface {
  name = 'UsuarioRefreshTokenHash1789791550415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "refresh_token_hash" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "refresh_token_hash"`);
  }
}
