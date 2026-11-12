import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloque 4, punto 4.3: tipo de notificación `reprogramacion` (aviso al
 * cliente cuando se mueve su reserva).
 *
 * Mismo patrón que `NotificacionWebhookResend` (renombrar el enum, crear el
 * nuevo y convertir la columna) en vez de `ALTER TYPE ... ADD VALUE`: así
 * todo corre dentro de la transacción de la migración y `down` es simétrico.
 * Va DESPUÉS de `NotificacionClaveUnica1794461165638`: el índice único
 * incluye `tipo` y PostgreSQL lo reconstruye al convertir la columna.
 *
 * No toca datos. `down` se niega a correr (con un mensaje claro) si ya hay
 * notificaciones `reprogramacion`, para no borrarlas ni convertirlas en otro
 * tipo sin que alguien lo decida.
 */
export class NotificacionTipoReprogramacion1794463653494 implements MigrationInterface {
  name = 'NotificacionTipoReprogramacion1794463653494';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notificaciones_tipo_enum" RENAME TO "notificaciones_tipo_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_tipo_enum" AS ENUM('recordatorio', 'confirmacion', 'cancelacion', 'reprogramacion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "tipo" TYPE "public"."notificaciones_tipo_enum" USING "tipo"::"text"::"public"."notificaciones_tipo_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notificaciones_tipo_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existentes: Array<{ total: string }> = await queryRunner.query(
      `SELECT count(*)::text AS total FROM "notificaciones" WHERE "tipo" = 'reprogramacion'`,
    );
    if (Number(existentes[0].total) > 0) {
      throw new Error(
        `NotificacionTipoReprogramacion (down): hay ${existentes[0].total} notificaciones de tipo 'reprogramacion'; decide qué hacer con ellas antes de quitar el tipo.`,
      );
    }
    await queryRunner.query(
      `CREATE TYPE "public"."notificaciones_tipo_enum_old" AS ENUM('recordatorio', 'confirmacion', 'cancelacion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "tipo" TYPE "public"."notificaciones_tipo_enum_old" USING "tipo"::"text"::"public"."notificaciones_tipo_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notificaciones_tipo_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notificaciones_tipo_enum_old" RENAME TO "notificaciones_tipo_enum"`,
    );
  }
}
