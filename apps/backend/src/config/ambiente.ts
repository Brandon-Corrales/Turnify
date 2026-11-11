import * as path from 'path';
import type { I18nOptionsWithoutResolvers } from 'nestjs-i18n';
import { esHostLocal } from '../database/host-local';
import type { OpcionesConexion } from '../database/opciones-conexion';

type Ambiente = 'development' | 'test' | 'production';

/**
 * Opciones de nestjs-i18n (Bloque 6, punto 6.4): recargar los JSON de
 * traducción al editarlos (`watch`) solo en desarrollo. En producción y en
 * pruebas no hace falta y deja un observador de archivos abierto.
 */
export function opcionesI18n(nodeEnv: Ambiente, dirI18n: string): I18nOptionsWithoutResolvers {
  return {
    fallbackLanguage: 'es',
    loaderOptions: {
      path: dirI18n,
      watch: nodeEnv === 'development',
    },
  };
}

/** Host de la conexión (de la URL o de DB_HOST), o `null` si no se puede leer. */
export function hostDeConexion(opciones: OpcionesConexion): string | null {
  if (opciones.url) {
    try {
      return new URL(opciones.url).hostname;
    } catch {
      return null;
    }
  }
  return opciones.host ?? null;
}

/**
 * Aviso de ambiente cruzado (Bloque 6, punto 6.4). No bloquea el arranque:
 * solo deja una advertencia en el log cuando la base configurada no parece
 * la del ambiente. Nunca incluye la cadena de conexión ni el host.
 * - production con una base local: probablemente falta DATABASE_URL.
 * - development o test con una base remota: hoy es lo normal en el equipo
 *   (todos usan Supabase), pero esa base es la de producción.
 */
export function avisoAmbienteBaseDatos(nodeEnv: Ambiente, host: string | null): string | null {
  if (!host) return null;
  const local = esHostLocal(host);
  if (nodeEnv === 'production' && local) {
    return 'NODE_ENV=production pero la base de datos configurada es local. Revisa DATABASE_URL en el entorno del servidor.';
  }
  if (nodeEnv !== 'production' && !local) {
    return (
      `NODE_ENV=${nodeEnv} pero la base de datos configurada es remota. ` +
      'Si es la de Supabase, es la misma que usa producción: no hagas pruebas destructivas ni corras migraciones sin respaldo.'
    );
  }
  return null;
}

/**
 * Migraciones al arrancar (Bloque 6, punto 6.4): desactivado por defecto.
 * Con MIGRATIONS_RUN_ON_START=true, TypeORM aplica las pendientes (una
 * transacción por migración) antes de que la app acepte solicitudes. Las
 * migraciones se compilan en dist/database/migrations.
 */
export function opcionesMigracionesAlArrancar(activado: boolean, dirDist: string) {
  if (!activado) return { migrationsRun: false };
  return {
    migrationsRun: true,
    migrationsTransactionMode: 'each' as const,
    migrations: [path.join(dirDist, 'database', 'migrations', '*.js')],
  };
}
