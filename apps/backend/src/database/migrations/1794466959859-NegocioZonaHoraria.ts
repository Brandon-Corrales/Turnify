import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloque 5, punto 5.1: zona horaria por negocio (nombre IANA).
 *
 * Columna nueva con valor por defecto `America/Costa_Rica`: los negocios
 * existentes quedan en la misma zona que el desfase fijo UTC-6 que se usaba
 * antes, así que su comportamiento no cambia. No toca otros datos.
 *
 * Compatible con el backend anterior durante el despliegue: ese código no
 * conoce la columna, así que al registrar un negocio no la manda y PostgreSQL
 * aplica el valor por defecto (NOT NULL se cumple). Probado contra la base
 * local con el build anterior (ver PROGRESS.md, Bloque 5).
 *
 * Simulación de solo lectura:
 * `src/database/simulaciones/1794466959859-NegocioZonaHoraria.sql`.
 * `down` quita la columna (los negocios que hayan elegido otra zona vuelven a
 * Costa Rica, que es lo único que entiende el código anterior).
 */
export class NegocioZonaHoraria1794466959859 implements MigrationInterface {
  name = 'NegocioZonaHoraria1794466959859';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "negocios" ADD "zona_horaria" character varying(64) NOT NULL DEFAULT 'America/Costa_Rica'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "negocios" DROP COLUMN "zona_horaria"`);
  }
}
