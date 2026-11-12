import {
  entornoConexionPruebas,
  entornoSinProveedoresExternos,
  exigirBaseDatosPruebasLocal,
} from './base-datos-pruebas';

/**
 * `setupFiles` de `vitest.integration.config.mts` (Bloque 6, punto 6.1).
 * Corre en cada worker ANTES de importar el archivo de prueba, es decir,
 * antes de que `AppModule` (y su `ConfigModule.forRoot`) lean el `.env`:
 * reemplaza la conexión de la app por la base local de pruebas y vacía las
 * claves de proveedores externos. Ver `base-datos-pruebas.ts`.
 */
Object.assign(process.env, {
  ...entornoConexionPruebas(exigirBaseDatosPruebasLocal()),
  ...entornoSinProveedoresExternos(),
});
