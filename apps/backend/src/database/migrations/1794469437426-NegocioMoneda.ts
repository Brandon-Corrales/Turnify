import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloque 5, punto 5.2: moneda por negocio (código ISO 4217; lista permitida
 * inicial CRC y USD, validada en el DTO).
 *
 * Columna nueva con valor por defecto `CRC`: los negocios existentes siguen
 * mostrando colones, igual que antes. Solo cambia cómo se MUESTRAN los
 * montos; los precios guardados (`servicios.precio`) no se tocan ni se
 * convierten.
 *
 * Compatible con el backend anterior durante el despliegue: no conoce la
 * columna y PostgreSQL aplica el valor por defecto al registrar un negocio.
 * Va después de `NegocioZonaHoraria1794466959859` (independientes entre sí).
 *
 * Simulación de solo lectura:
 * `src/database/simulaciones/1794469437426-NegocioMoneda.sql`.
 * `down` quita la columna (todos vuelven a colones).
 */
export class NegocioMoneda1794469437426 implements MigrationInterface {
  name = 'NegocioMoneda1794469437426';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "negocios" ADD "moneda" character varying(3) NOT NULL DEFAULT 'CRC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "negocios" DROP COLUMN "moneda"`);
  }
}
