import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas de INTEGRACIÓN (`*.integration.spec.ts`), separadas de las
 * unitarias. Solo corren contra el Postgres local de pruebas
 * (`TEST_DATABASE_URL`, host local obligatorio): `globalSetup` lo verifica
 * y aplica las migraciones, y `setupFiles` hace que la app use esa base en
 * vez de la del `.env` (Supabase, producción). Ver
 * `src/test-utils/base-datos-pruebas.ts`.
 *
 * Archivos en serie: comparten la misma base y el mismo límite de
 * solicitudes por minuto de /auth.
 */
export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.integration.spec.ts'],
    environment: 'node',
    globals: false,
    globalSetup: ['./src/test-utils/global-setup-integracion.ts'],
    setupFiles: ['./src/test-utils/entorno-integracion.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  plugins: [swc.vite()],
});
