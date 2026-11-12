import { prepararBasePruebas } from './preparar-base-pruebas';

/**
 * `globalSetup` de `vitest.integration.config.mts`: una sola vez antes de
 * todas las suites, verifica que la base sea local y aplica las
 * migraciones pendientes.
 */
export default function setup(): void {
  prepararBasePruebas();
}
