import * as fs from 'fs';
import type { TlsOptions } from 'tls';

/**
 * Opciones de conexión a PostgreSQL compartidas por la app (`app.module.ts`)
 * y el CLI de TypeORM (`data-source.ts`) — Bloque 6, punto 6.3.
 *
 * SSL:
 * - Con `DB_SSL_CA` (contenido PEM del certificado) o `DB_SSL_CA_PATH`
 *   (ruta al archivo), el certificado del servidor SE VALIDA contra esa CA
 *   y se comprueba que el host coincida (equivale a `sslmode=verify-full`,
 *   el modo que recomienda Supabase:
 *   https://supabase.com/docs/guides/platform/ssl-enforcement). La CA de
 *   Supabase se descarga en el panel: Database Settings → SSL Configuration.
 * - Sin ninguna de las dos se conserva el comportamiento anterior: con
 *   `DATABASE_URL` la conexión va cifrada pero SIN validar el certificado
 *   (`rejectUnauthorized: false`); con `DB_HOST`/`DB_*`, sin SSL.
 */

export interface EntornoConexion {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: number | string;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_SSL_CA?: string;
  DB_SSL_CA_PATH?: string;
}

export interface OpcionesConexion {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: TlsOptions | false;
}

type LeerArchivo = (ruta: string) => string;

const leerArchivoUtf8: LeerArchivo = (ruta) => fs.readFileSync(ruta, 'utf8');

const vacio = (valor: string | undefined): boolean => !valor || valor.trim() === '';

/**
 * Devuelve el PEM de la CA configurada, o `undefined` si no hay ninguna.
 * Acepta el contenido con saltos de línea escapados (`\n`), que es como
 * suele quedar al pegarlo en una sola línea en un panel de variables.
 */
export function leerCertificadoCa(
  entorno: Pick<EntornoConexion, 'DB_SSL_CA' | 'DB_SSL_CA_PATH'>,
  leerArchivo: LeerArchivo = leerArchivoUtf8,
): string | undefined {
  if (!vacio(entorno.DB_SSL_CA)) return entorno.DB_SSL_CA!.replace(/\\n/g, '\n');
  if (!vacio(entorno.DB_SSL_CA_PATH)) {
    try {
      return leerArchivo(entorno.DB_SSL_CA_PATH!.trim());
    } catch {
      // Sin la ruta en el mensaje a propósito: solo el nombre de la variable.
      throw new Error('No se pudo leer el certificado indicado en DB_SSL_CA_PATH.');
    }
  }
  return undefined;
}

export function construirOpcionesConexion(
  entorno: EntornoConexion,
  leerArchivo: LeerArchivo = leerArchivoUtf8,
): OpcionesConexion {
  const ca = leerCertificadoCa(entorno, leerArchivo);
  const sslValidado: TlsOptions | undefined = ca ? { ca, rejectUnauthorized: true } : undefined;

  if (!vacio(entorno.DATABASE_URL)) {
    return {
      url: entorno.DATABASE_URL,
      ssl: sslValidado ?? { rejectUnauthorized: false },
    };
  }

  return {
    host: entorno.DB_HOST ?? 'localhost',
    port: Number(entorno.DB_PORT ?? 5432),
    username: entorno.DB_USERNAME ?? 'turnify',
    password: entorno.DB_PASSWORD ?? 'turnify',
    database: entorno.DB_NAME ?? 'turnify',
    ...(sslValidado ? { ssl: sslValidado } : {}),
  };
}
