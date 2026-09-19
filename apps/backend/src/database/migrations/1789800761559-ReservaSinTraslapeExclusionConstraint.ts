import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Red de seguridad a nivel de base de datos contra el doble-booking bajo
 * concurrencia (punto 3 del brief): incluso si dos requests concurrentes
 * lograran pasar el chequeo de traslapes de la aplicación al mismo
 * tiempo (una carrera que un simple SELECT-antes-de-INSERT no puede
 * descartar del todo), Postgres rechaza el segundo INSERT con este
 * EXCLUDE constraint — no depende de que la aplicación acierte el locking.
 *
 * btree_gist es necesario porque EXCLUDE con un uuid (comparado por
 * igualdad) combinado con un rango (tstzrange, comparado por
 * solapamiento &&) requiere operadores GiST para el tipo uuid, que solo
 * btree_gist provee.
 */
export class ReservaSinTraslapeExclusionConstraint1789800761559 implements MigrationInterface {
  name = 'ReservaSinTraslapeExclusionConstraint1789800761559';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
    await queryRunner.query(`
      ALTER TABLE "reservas"
      ADD CONSTRAINT "no_traslape_reserva_usuario"
      EXCLUDE USING gist (
        "id_usuario" WITH =,
        tstzrange("fecha_hora_inicio", "fecha_hora_fin") WITH &&
      )
      WHERE ("estado" <> 'cancelada')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservas" DROP CONSTRAINT "no_traslape_reserva_usuario"`);
  }
}
