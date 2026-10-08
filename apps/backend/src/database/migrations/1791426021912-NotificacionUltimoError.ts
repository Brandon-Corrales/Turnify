import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda el motivo que devolvió el proveedor (Resend / Meta) en el último
 * intento fallido de una notificación. Antes solo quedaba en el log del
 * servidor y el historial mostraba "pendiente"/"fallida" sin explicación.
 * Nullable: las notificaciones enviadas o sin intentos no tienen motivo.
 */
export class NotificacionUltimoError1791426021912 implements MigrationInterface {
  name = 'NotificacionUltimoError1791426021912';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notificaciones" ADD "ultimo_error" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notificaciones" DROP COLUMN "ultimo_error"`);
  }
}
