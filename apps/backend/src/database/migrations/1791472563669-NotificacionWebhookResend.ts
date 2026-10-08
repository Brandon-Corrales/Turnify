import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soporte del webhook de Resend (rebotes, entregas, quejas):
 * - `notificaciones.id_correo_proveedor`: id que devuelve Resend al aceptar
 *   el envío; los eventos lo traen como `data.email_id`.
 * - estado `entregada` en `notificaciones_estado_enum` (Resend confirmó la
 *   entrega al servidor del destinatario).
 * - `webhook_eventos_procesados`: idempotencia por `svix-id`.
 *
 * Nota: `migration:generate` también proponía DROP de la exclusion
 * constraint `no_traslape_reserva_usuario` (TypeORM no la modela); se quitó
 * a mano, igual que en migraciones anteriores.
 */
export class NotificacionWebhookResend1791472563669 implements MigrationInterface {
  name = 'NotificacionWebhookResend1791472563669';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook_eventos_procesados" ("creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_mensaje" character varying(255) NOT NULL, "proveedor" character varying(32) NOT NULL, "tipo_evento" character varying(64) NOT NULL, CONSTRAINT "PK_b9ae07eefa612221c302e0a2583" PRIMARY KEY ("id_mensaje"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD "id_correo_proveedor" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9bcd27aed07aabd58e6a9535c2" ON "notificaciones" ("id_correo_proveedor") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notificaciones_estado_enum" RENAME TO "notificaciones_estado_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_estado_enum" AS ENUM('pendiente', 'enviada', 'entregada', 'fallida')`,
    );
    await queryRunner.query(`ALTER TABLE "notificaciones" ALTER COLUMN "estado" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "estado" TYPE "public"."notificaciones_estado_enum" USING "estado"::"text"::"public"."notificaciones_estado_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "estado" SET DEFAULT 'pendiente'`,
    );
    await queryRunner.query(`DROP TYPE "public"."notificaciones_estado_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 'entregada' no existe en el enum viejo: vuelve a 'enviada' (lo que era
    // antes de que llegara el webhook).
    await queryRunner.query(
      `UPDATE "notificaciones" SET "estado" = 'enviada' WHERE "estado" = 'entregada'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_estado_enum_old" AS ENUM('pendiente', 'enviada', 'fallida')`,
    );
    await queryRunner.query(`ALTER TABLE "notificaciones" ALTER COLUMN "estado" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "estado" TYPE "public"."notificaciones_estado_enum_old" USING "estado"::"text"::"public"."notificaciones_estado_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "estado" SET DEFAULT 'pendiente'`,
    );
    await queryRunner.query(`DROP TYPE "public"."notificaciones_estado_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notificaciones_estado_enum_old" RENAME TO "notificaciones_estado_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_9bcd27aed07aabd58e6a9535c2"`);
    await queryRunner.query(`ALTER TABLE "notificaciones" DROP COLUMN "id_correo_proveedor"`);
    await queryRunner.query(`DROP TABLE "webhook_eventos_procesados"`);
  }
}
