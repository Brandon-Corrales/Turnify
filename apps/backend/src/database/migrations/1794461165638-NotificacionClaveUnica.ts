import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloque 4, punto 4.1: un solo envío por (reserva, tipo, hora de la cita).
 *
 * - `notificaciones.fecha_hora_reserva`: hora de inicio de la cita a la que se
 *   refiere el aviso, tal como estaba al programarlo. Es parte de la clave
 *   porque una reserva reprogramada necesita un recordatorio nuevo para la hora
 *   nueva (con `(id_reserva, tipo)` solo, el cron vería que "ya existe" y no
 *   avisaría nunca la hora nueva).
 * - Las filas existentes se rellenan con la hora ACTUAL de su reserva. Para
 *   una reserva reprogramada después de su recordatorio, el valor no es la hora
 *   que decía ese recordatorio; no hay otra fuente (el texto del mensaje está
 *   traducido y formateado), y para la clave basta con que sea estable.
 * - Limpia los duplicados existentes: por cada clave conserva una fila, la ya
 *   enviada o entregada si la hay y, si no, la más antigua. Script de
 *   simulación de solo lectura: `src/database/simulaciones/1794461165638-NotificacionClaveUnica.sql`.
 * - Índice único `UQ_notificaciones_reserva_tipo_fecha`. Si después de la
 *   limpieza quedara algún duplicado o alguna fila sin hora, la migración
 *   falla con un mensaje claro y la transacción se revierte entera.
 *
 * - Trigger de compatibilidad `trg_notificaciones_fecha_hora_reserva`
 *   (BEFORE INSERT): si un INSERT no trae `fecha_hora_reserva` (el backend
 *   anterior a esta migración no conoce la columna), la toma de
 *   `reservas.fecha_hora_inicio`. Así, mientras Render o un backend local del
 *   equipo sigan con el código anterior, sus notificaciones no fallan por el
 *   NOT NULL, y el índice único igual impide sus duplicados. El código nuevo
 *   siempre manda la columna, así que el trigger no lo toca. Se quita con
 *   `src/database/migraciones-diferidas/1794466222654-NotificacionQuitarTriggerCompatibilidad.ts`
 *   cuando todos los backends tengan el código nuevo (ver PROGRESS.md).
 *
 * `down` quita el trigger, el índice y la columna. Las filas borradas NO
 * vuelven: para recuperarlas hace falta el respaldo previo.
 */
export class NotificacionClaveUnica1794461165638 implements MigrationInterface {
  name = 'NotificacionClaveUnica1794461165638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD "fecha_hora_reserva" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "notificaciones" n SET "fecha_hora_reserva" = r."fecha_hora_inicio"
       FROM "reservas" r WHERE r."id_reserva" = n."id_reserva"`,
    );

    const sinHora: Array<{ total: string }> = await queryRunner.query(
      `SELECT count(*)::text AS total FROM "notificaciones" WHERE "fecha_hora_reserva" IS NULL`,
    );
    if (Number(sinHora[0].total) > 0) {
      throw new Error(
        `NotificacionClaveUnica: ${sinHora[0].total} notificaciones no tienen reserva de la que tomar la hora; revísalas antes de migrar.`,
      );
    }

    await queryRunner.query(
      `DELETE FROM "notificaciones" WHERE "id_notificacion" IN (
         SELECT "id_notificacion" FROM (
           SELECT "id_notificacion", row_number() OVER (
             PARTITION BY "id_reserva", "tipo", "fecha_hora_reserva"
             ORDER BY ("estado" IN ('enviada', 'entregada')) DESC, "creado_en" ASC, "id_notificacion" ASC
           ) AS posicion
           FROM "notificaciones"
         ) clasificadas
         WHERE posicion > 1
       )`,
    );

    const duplicados: Array<{ grupos: string }> = await queryRunner.query(
      `SELECT count(*)::text AS grupos FROM (
         SELECT 1 FROM "notificaciones"
         GROUP BY "id_reserva", "tipo", "fecha_hora_reserva" HAVING count(*) > 1
       ) g`,
    );
    if (Number(duplicados[0].grupos) > 0) {
      throw new Error(
        `NotificacionClaveUnica: quedan ${duplicados[0].grupos} grupos duplicados de (id_reserva, tipo, fecha_hora_reserva) después de la limpieza; no se crea el índice único.`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "notificaciones" ALTER COLUMN "fecha_hora_reserva" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notificaciones_reserva_tipo_fecha" ON "notificaciones" ("id_reserva", "tipo", "fecha_hora_reserva")`,
    );

    // Compatibilidad con el backend anterior (ver comentario de la clase).
    // Los BEFORE triggers corren antes de verificar el NOT NULL y el índice.
    await queryRunner.query(
      `CREATE FUNCTION "notificaciones_completar_fecha_hora_reserva"() RETURNS trigger
       LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW."fecha_hora_reserva" IS NULL THEN
           SELECT r."fecha_hora_inicio" INTO NEW."fecha_hora_reserva"
           FROM "reservas" r WHERE r."id_reserva" = NEW."id_reserva";
         END IF;
         RETURN NEW;
       END
       $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_notificaciones_fecha_hora_reserva"
       BEFORE INSERT ON "notificaciones"
       FOR EACH ROW EXECUTE FUNCTION "notificaciones_completar_fecha_hora_reserva"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // IF EXISTS: puede haberlo quitado ya la migración diferida.
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_notificaciones_fecha_hora_reserva" ON "notificaciones"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "notificaciones_completar_fecha_hora_reserva"()`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_notificaciones_reserva_tipo_fecha"`);
    await queryRunner.query(`ALTER TABLE "notificaciones" DROP COLUMN "fecha_hora_reserva"`);
  }
}
