import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MIGRACIÓN DIFERIDA — NO forma parte del primer despliegue del Bloque 4.
 *
 * Quita el trigger de compatibilidad `trg_notificaciones_fecha_hora_reserva`
 * que crea `NotificacionClaveUnica1794461165638`. Ejecutar SOLO cuando TODOS
 * los backends que escriben en la base (Render y los locales del equipo)
 * tengan el código nuevo, que siempre manda `fecha_hora_reserva`. Si después
 * de quitarlo queda algún backend anterior, sus notificaciones vuelven a
 * fallar por el NOT NULL.
 *
 * Vive fuera de `src/database/migrations/` a propósito: el data-source solo
 * carga esa carpeta, así que `migration:run` y `MIGRATIONS_RUN_ON_START` no la
 * ejecutan por accidente. Para aplicarla: `git mv` a `src/database/migrations/`,
 * commit, y `npm run migration:run` (procedimiento en PROGRESS.md, Bloque 4).
 *
 * No toca datos. `down` vuelve a crear el trigger y la función tal cual.
 */
export class NotificacionQuitarTriggerCompatibilidad1794466222654 implements MigrationInterface {
  name = 'NotificacionQuitarTriggerCompatibilidad1794466222654';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_notificaciones_fecha_hora_reserva" ON "notificaciones"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "notificaciones_completar_fecha_hora_reserva"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
