import { spawnSync } from 'child_process';
import * as path from 'path';
import {
  entornoConexionPruebas,
  exigirBaseDatosPruebasLocal,
  hostDeUrl,
} from './base-datos-pruebas';

const RAIZ_BACKEND = path.resolve(__dirname, '..', '..');

/**
 * Aplica las migraciones pendientes sobre la base de PRUEBAS local
 * (Bloque 6, punto 6.1). Lo usan el `globalSetup` de las pruebas de
 * integración y el script `test:e2e`. Se niega a correr si
 * `TEST_DATABASE_URL` falta o no es local.
 *
 * Usa el mismo CLI de TypeORM que `npm run migration:run` (ts-node), en un
 * proceso hijo con la conexión de pruebas en su entorno. Cargar las
 * migraciones `.ts` desde dentro de Vitest no funciona: TypeORM las
 * importa con el `require` nativo de Node, que no transpila TypeScript.
 */
export function prepararBasePruebas(): void {
  const url = exigirBaseDatosPruebasLocal();
  console.log(`[pruebas] Aplicando migraciones en la base de pruebas (${hostDeUrl(url)})…`);
  const resultado = spawnSync('npm', ['run', '--silent', 'migration:run'], {
    cwd: RAIZ_BACKEND,
    env: { ...process.env, ...entornoConexionPruebas(url) },
    encoding: 'utf8',
  });
  if (resultado.status !== 0) {
    throw new Error(
      `[pruebas] Falló migration:run en la base de pruebas:\n${resultado.stderr || resultado.stdout}`,
    );
  }
  const aplicadas = (resultado.stdout.match(/executed successfully/g) ?? []).length;
  console.log(`[pruebas] Base de pruebas lista (${aplicadas} migración(es) nueva(s)).`);
}

// Uso directo: `npm run test:db:prepare`
if (require.main === module) {
  try {
    prepararBasePruebas();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
