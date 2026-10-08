import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración de DATOS (no cambia el esquema): `ultimo_error` guardaba el
 * texto crudo del proveedor, que puede incluir el correo de la persona
 * dueña de la cuenta de Resend del equipo. Lo reemplaza por la categoría
 * saneada (`MotivoFallo`), con las mismas reglas que
 * `clasificarRechazoProveedor()`.
 *
 * `down` no hace nada a propósito: el texto crudo no se puede (ni se debe)
 * reconstruir.
 */
export class NotificacionMotivoSaneado1791430080850 implements MigrationInterface {
  name = 'NotificacionMotivoSaneado1791430080850';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "notificaciones" SET "ultimo_error" = CASE
        WHEN "ultimo_error" IN ('DESTINATARIO_NO_HABILITADO', 'CREDENCIALES_FALTANTES',
                                'CANAL_SIN_PROVEEDOR', 'RECHAZADO_POR_PROVEEDOR')
          THEN "ultimo_error"
        WHEN lower("ultimo_error") LIKE '%testing emails%'
          OR lower("ultimo_error") LIKE '%verify a domain%'
          OR "ultimo_error" LIKE '%131030%'
          OR lower("ultimo_error") LIKE '%not in allowed list%'
          THEN 'DESTINATARIO_NO_HABILITADO'
        WHEN "ultimo_error" LIKE '%no configurada%' OR "ultimo_error" LIKE '%no configurados%'
          THEN 'CREDENCIALES_FALTANTES'
        WHEN "ultimo_error" LIKE '%no tiene proveedor implementado%'
          THEN 'CANAL_SIN_PROVEEDOR'
        ELSE 'RECHAZADO_POR_PROVEEDOR'
      END
      WHERE "ultimo_error" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Irreversible a propósito (ver comentario de la clase).
  }
}
