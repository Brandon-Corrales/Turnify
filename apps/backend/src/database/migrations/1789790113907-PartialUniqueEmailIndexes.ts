import { MigrationInterface, QueryRunner } from 'typeorm';

export class PartialUniqueEmailIndexes1789790113907 implements MigrationInterface {
  name = 'PartialUniqueEmailIndexes1789790113907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "uq_cliente_negocio_correo"`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "UQ_e871b7157e4b74290df9baa9c93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "negocios" DROP CONSTRAINT "UQ_3061d2b3c985425c1904391e14f"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cliente_negocio_correo_activo" ON "clientes" ("id_negocio", "correo_electronico") WHERE "eliminado_en" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_usuario_correo_activo" ON "usuarios" ("correo_electronico") WHERE "eliminado_en" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_negocio_correo_activo" ON "negocios" ("correo_electronico") WHERE "eliminado_en" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_negocio_correo_activo"`);
    await queryRunner.query(`DROP INDEX "public"."uq_usuario_correo_activo"`);
    await queryRunner.query(`DROP INDEX "public"."uq_cliente_negocio_correo_activo"`);
    await queryRunner.query(
      `ALTER TABLE "negocios" ADD CONSTRAINT "UQ_3061d2b3c985425c1904391e14f" UNIQUE ("correo_electronico")`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD CONSTRAINT "UQ_e871b7157e4b74290df9baa9c93" UNIQUE ("correo_electronico")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clientes" ADD CONSTRAINT "uq_cliente_negocio_correo" UNIQUE ("id_negocio", "correo_electronico")`,
    );
  }
}
