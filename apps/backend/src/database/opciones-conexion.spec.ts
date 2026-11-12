import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { validateEnv } from '../config/env.schema';
import { construirOpcionesConexion, leerCertificadoCa } from './opciones-conexion';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';
const URL_REMOTA = 'postgresql://u:p@db.proyecto.supabase.co:5432/postgres';

const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'turnify-ca-'));
const rutaCa = path.join(dirTemporal, 'prod-ca.crt');
fs.writeFileSync(rutaCa, PEM);
afterAll(() => fs.rmSync(dirTemporal, { recursive: true, force: true }));

describe('construirOpcionesConexion — comportamiento anterior sin CA', () => {
  it('con DATABASE_URL: SSL sin validar el certificado (igual que antes)', () => {
    expect(construirOpcionesConexion({ DATABASE_URL: URL_REMOTA })).toEqual({
      url: URL_REMOTA,
      ssl: { rejectUnauthorized: false },
    });
  });

  it('sin DATABASE_URL: campos DB_* y sin SSL (igual que antes)', () => {
    expect(
      construirOpcionesConexion({
        DB_HOST: 'localhost',
        DB_PORT: 5433,
        DB_USERNAME: 'u',
        DB_PASSWORD: 'p',
        DB_NAME: 'db',
      }),
    ).toEqual({ host: 'localhost', port: 5433, username: 'u', password: 'p', database: 'db' });
  });

  it('DATABASE_URL vacía o con espacios cuenta como no definida', () => {
    expect(construirOpcionesConexion({ DATABASE_URL: '  ' })).not.toHaveProperty('url');
  });

  it('usa los mismos valores por defecto que el esquema de env', () => {
    expect(construirOpcionesConexion({})).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'turnify',
      password: 'turnify',
      database: 'turnify',
    });
  });

  it('convierte DB_PORT de texto (process.env en el CLI de TypeORM)', () => {
    expect(construirOpcionesConexion({ DB_PORT: '6543' }).port).toBe(6543);
  });
});

describe('construirOpcionesConexion — con CA definida', () => {
  it('DB_SSL_CA: valida el certificado del servidor contra esa CA', () => {
    expect(construirOpcionesConexion({ DATABASE_URL: URL_REMOTA, DB_SSL_CA: PEM })).toEqual({
      url: URL_REMOTA,
      ssl: { ca: PEM, rejectUnauthorized: true },
    });
  });

  it('DB_SSL_CA_PATH: lee el archivo y valida', () => {
    expect(
      construirOpcionesConexion({ DATABASE_URL: URL_REMOTA, DB_SSL_CA_PATH: rutaCa }).ssl,
    ).toEqual({
      ca: PEM,
      rejectUnauthorized: true,
    });
  });

  it('también aplica la validación con la conexión por DB_*', () => {
    expect(construirOpcionesConexion({ DB_HOST: 'db.ejemplo.com', DB_SSL_CA: PEM }).ssl).toEqual({
      ca: PEM,
      rejectUnauthorized: true,
    });
  });
});

describe('leerCertificadoCa', () => {
  it('convierte los \\n escapados (PEM pegado en una sola línea) en saltos reales', () => {
    const unaLinea = PEM.replace(/\n/g, '\\n');
    expect(leerCertificadoCa({ DB_SSL_CA: unaLinea })).toBe(PEM);
  });

  it('prefiere DB_SSL_CA sobre DB_SSL_CA_PATH y no lee el archivo', () => {
    const leer = vi.fn();
    expect(leerCertificadoCa({ DB_SSL_CA: PEM, DB_SSL_CA_PATH: '/x' }, leer)).toBe(PEM);
    expect(leer).not.toHaveBeenCalled();
  });

  it('sin ninguna de las dos devuelve undefined', () => {
    expect(leerCertificadoCa({ DB_SSL_CA: '', DB_SSL_CA_PATH: ' ' })).toBeUndefined();
  });

  it('si el archivo no se puede leer, el error nombra la variable pero no la ruta', () => {
    expect(() => leerCertificadoCa({ DB_SSL_CA_PATH: '/ruta/secreta/no-existe.crt' })).toThrow(
      'No se pudo leer el certificado indicado en DB_SSL_CA_PATH.',
    );
  });
});

describe('env.schema — DB_SSL_CA / DB_SSL_CA_PATH', () => {
  const base = { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'r' };

  it('son opcionales y vacías cuentan como no definidas', () => {
    const env = validateEnv({ ...base, DB_SSL_CA: '', DB_SSL_CA_PATH: '' });
    expect(env.DB_SSL_CA).toBeUndefined();
    expect(env.DB_SSL_CA_PATH).toBeUndefined();
  });

  it('acepta un PEM válido', () => {
    expect(validateEnv({ ...base, DB_SSL_CA: PEM }).DB_SSL_CA).toBe(PEM);
  });

  it('rechaza un DB_SSL_CA que no es PEM', () => {
    expect(() => validateEnv({ ...base, DB_SSL_CA: 'no-es-un-certificado' })).toThrow(/DB_SSL_CA/);
  });

  it('acepta una ruta existente y rechaza una inexistente', () => {
    expect(validateEnv({ ...base, DB_SSL_CA_PATH: rutaCa }).DB_SSL_CA_PATH).toBe(rutaCa);
    expect(() =>
      validateEnv({ ...base, DB_SSL_CA_PATH: path.join(dirTemporal, 'no.crt') }),
    ).toThrow(/DB_SSL_CA_PATH/);
  });

  it('rechaza definir ambas', () => {
    expect(() => validateEnv({ ...base, DB_SSL_CA: PEM, DB_SSL_CA_PATH: rutaCa })).toThrow(
      /no ambas/,
    );
  });
});
