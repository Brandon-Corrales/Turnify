import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { esHostLocal } from '../database/host-local';

export { esHostLocal };

/**
 * Protección de la base de datos de pruebas (Bloque 6, punto 6.1).
 *
 * La base de Supabase que apunta el `.env` del equipo es la MISMA que usa
 * producción. Las pruebas de integración y el E2E escriben datos de
 * verdad (registran negocios, crean reservas), así que solo pueden correr
 * contra un Postgres local y desechable (`docker compose --profile test`).
 *
 * Reglas: `TEST_DATABASE_URL` es obligatoria y su host debe ser local. Si
 * no se cumple, se lanza un error claro ANTES de abrir cualquier conexión.
 * El mensaje nunca incluye la cadena de conexión (podría traer la
 * contraseña), solo el nombre de la variable y el host.
 */

/** Ruta del `.env` único del monorepo (mismo criterio que app.module.ts). */
const RUTA_ENV_RAIZ = path.resolve(__dirname, '../../../../.env');

/** Host de una cadena de conexión, o `null` si no se puede interpretar. */
export function hostDeUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Lee `TEST_DATABASE_URL` del entorno del proceso o, si no está, del
 * `.env` de la raíz. Usa `dotenv.parse` a propósito: no copia al proceso
 * el resto de variables de ese archivo (entre ellas el `DATABASE_URL` de
 * Supabase).
 */
export function leerTestDatabaseUrl(
  entorno: NodeJS.ProcessEnv = process.env,
  rutaEnv: string = RUTA_ENV_RAIZ,
): string | undefined {
  const delProceso = entorno.TEST_DATABASE_URL?.trim();
  if (delProceso) return delProceso;
  if (!fs.existsSync(rutaEnv)) return undefined;
  const delArchivo = dotenv.parse(fs.readFileSync(rutaEnv)).TEST_DATABASE_URL?.trim();
  return delArchivo || undefined;
}

export class BaseDatosPruebasNoSeguraError extends Error {
  constructor(motivo: string) {
    super(
      `[pruebas] ${motivo}\n` +
        'Las pruebas de integración y el E2E solo corren contra el Postgres local de pruebas.\n' +
        'Levántalo con `npm run db:test:up` (desde la raíz) y define\n' +
        'TEST_DATABASE_URL=postgresql://turnify_test:turnify_test@localhost:5433/turnify_test\n' +
        '(ver .env.example). Nunca apuntes estas pruebas a Supabase: es la base de producción.',
    );
    this.name = 'BaseDatosPruebasNoSeguraError';
  }
}

/**
 * Devuelve `TEST_DATABASE_URL` solo si existe y su host es local; si no,
 * lanza `BaseDatosPruebasNoSeguraError`.
 */
export function exigirBaseDatosPruebasLocal(
  entorno: NodeJS.ProcessEnv = process.env,
  rutaEnv: string = RUTA_ENV_RAIZ,
): string {
  const url = leerTestDatabaseUrl(entorno, rutaEnv);
  if (!url) {
    throw new BaseDatosPruebasNoSeguraError('Falta la variable TEST_DATABASE_URL.');
  }
  const host = hostDeUrl(url);
  if (!host) {
    throw new BaseDatosPruebasNoSeguraError('TEST_DATABASE_URL no es una URL válida.');
  }
  if (!esHostLocal(host)) {
    throw new BaseDatosPruebasNoSeguraError(
      `El host de TEST_DATABASE_URL ("${host}") no es local; se cancela para no escribir en una base remota.`,
    );
  }
  return url;
}

/**
 * Comprueba la conexión que de verdad va a usar la app (después de que
 * `ConfigModule` cargó el `.env`): `DATABASE_URL` si existe, o `DB_HOST`.
 * Es la segunda capa de protección para quien ejecute un
 * `*.integration.spec.ts` sin la configuración de integración.
 */
export function exigirConexionEfectivaLocal(entorno: NodeJS.ProcessEnv = process.env): void {
  const url = entorno.DATABASE_URL?.trim();
  const host = url ? hostDeUrl(url) : (entorno.DB_HOST ?? 'localhost');
  if (!host || !esHostLocal(host)) {
    throw new BaseDatosPruebasNoSeguraError(
      'La conexión que usaría la app no es local (DATABASE_URL o DB_HOST apuntan a otro servidor). ' +
        'Corre las pruebas de integración con `npm run test:integration`.',
    );
  }
}

/**
 * Variables que hacen que la app (o el CLI de TypeORM) use la base de
 * pruebas en vez de la del `.env`. Las del proceso tienen prioridad sobre
 * el `.env` (`@nestjs/config` y `dotenv` no las sobrescriben):
 * - `DATABASE_URL` vacía: el esquema de env la trata como no definida, así
 *   que no gana la de Supabase.
 * - `DB_*` se toman de la URL de pruebas. Esa rama de conexión no fuerza
 *   SSL, que el Postgres de docker-compose no soporta.
 */
export function entornoConexionPruebas(urlPruebas: string): Record<string, string> {
  const url = new URL(urlPruebas);
  return {
    NODE_ENV: 'test',
    DATABASE_URL: '',
    DB_HOST: url.hostname,
    DB_PORT: url.port || '5432',
    DB_USERNAME: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password),
    DB_NAME: url.pathname.replace(/^\//, ''),
  };
}

/**
 * Claves de proveedores externos que se vacían en integración y E2E. La
 * app completa incluye el cron de notificaciones, el chatbot y Stripe; con
 * las claves del `.env` del equipo podría llamar a Resend, WhatsApp,
 * Stripe o Groq de verdad. Vacías, cada proveedor se comporta como "no
 * configurado"; las suites que necesitan uno lo reemplazan por un doble.
 */
export const CLAVES_PROVEEDORES_EXTERNOS = [
  'RESEND_API_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PLAN_PAGO',
  'LLM_API_KEY',
] as const;

export function entornoSinProveedoresExternos(): Record<string, string> {
  return Object.fromEntries(CLAVES_PROVEEDORES_EXTERNOS.map((clave) => [clave, '']));
}
