import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BaseDatosPruebasNoSeguraError,
  CLAVES_PROVEEDORES_EXTERNOS,
  entornoConexionPruebas,
  entornoSinProveedoresExternos,
  esHostLocal,
  exigirBaseDatosPruebasLocal,
  exigirConexionEfectivaLocal,
  leerTestDatabaseUrl,
} from './base-datos-pruebas';

const LOCAL = 'postgresql://turnify_test:turnify_test@localhost:5433/turnify_test';
const REMOTA = 'postgresql://u:secreto@db.proyecto.supabase.co:5432/postgres';

const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'turnify-env-'));
const envInexistente = path.join(dirTemporal, 'no-existe.env');

function escribirEnv(contenido: string): string {
  const ruta = path.join(dirTemporal, `${Math.random().toString(36).slice(2)}.env`);
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

afterAll(() => fs.rmSync(dirTemporal, { recursive: true, force: true }));

describe('esHostLocal', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST'])('acepta %s', (host) => {
    expect(esHostLocal(host)).toBe(true);
  });

  it.each(['db.proyecto.supabase.co', 'aws-0-region.pooler.supabase.com', '10.0.0.5', 'postgres'])(
    'rechaza %s',
    (host) => {
      expect(esHostLocal(host)).toBe(false);
    },
  );
});

describe('leerTestDatabaseUrl', () => {
  it('prefiere la variable del proceso', () => {
    const ruta = escribirEnv(`TEST_DATABASE_URL=${REMOTA}\n`);
    expect(leerTestDatabaseUrl({ TEST_DATABASE_URL: LOCAL }, ruta)).toBe(LOCAL);
  });

  it('cae al .env sin copiar sus otras variables al entorno', () => {
    const ruta = escribirEnv(`TEST_DATABASE_URL=${LOCAL}\nDATABASE_URL=${REMOTA}\n`);
    const entorno: NodeJS.ProcessEnv = {};
    expect(leerTestDatabaseUrl(entorno, ruta)).toBe(LOCAL);
    expect(entorno.DATABASE_URL).toBeUndefined();
  });

  it('devuelve undefined si no está en ningún lado o está vacía', () => {
    expect(leerTestDatabaseUrl({}, envInexistente)).toBeUndefined();
    expect(
      leerTestDatabaseUrl({ TEST_DATABASE_URL: '  ' }, escribirEnv('TEST_DATABASE_URL=\n')),
    ).toBeUndefined();
  });
});

describe('exigirBaseDatosPruebasLocal', () => {
  it('devuelve la URL cuando el host es local', () => {
    expect(exigirBaseDatosPruebasLocal({ TEST_DATABASE_URL: LOCAL }, envInexistente)).toBe(LOCAL);
  });

  it('se niega si falta TEST_DATABASE_URL', () => {
    expect(() => exigirBaseDatosPruebasLocal({}, envInexistente)).toThrow(
      /Falta la variable TEST_DATABASE_URL/,
    );
  });

  it('se niega si el host no es local, sin mostrar la contraseña', () => {
    let error: unknown;
    try {
      exigirBaseDatosPruebasLocal({ TEST_DATABASE_URL: REMOTA }, envInexistente);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BaseDatosPruebasNoSeguraError);
    expect((error as Error).message).toContain('db.proyecto.supabase.co');
    expect((error as Error).message).not.toContain('secreto');
  });

  it('se niega si la URL no es válida', () => {
    expect(() =>
      exigirBaseDatosPruebasLocal({ TEST_DATABASE_URL: 'no-es-url' }, envInexistente),
    ).toThrow(/no es una URL válida/);
  });
});

describe('exigirConexionEfectivaLocal', () => {
  it('acepta DATABASE_URL vacía con DB_HOST local', () => {
    expect(() =>
      exigirConexionEfectivaLocal({ DATABASE_URL: '', DB_HOST: 'localhost' }),
    ).not.toThrow();
  });

  it('acepta DATABASE_URL local', () => {
    expect(() => exigirConexionEfectivaLocal({ DATABASE_URL: LOCAL })).not.toThrow();
  });

  it('se niega si DATABASE_URL apunta a Supabase', () => {
    expect(() => exigirConexionEfectivaLocal({ DATABASE_URL: REMOTA })).toThrow(
      BaseDatosPruebasNoSeguraError,
    );
  });

  it('se niega si DB_HOST no es local', () => {
    expect(() => exigirConexionEfectivaLocal({ DB_HOST: 'db.proyecto.supabase.co' })).toThrow(
      BaseDatosPruebasNoSeguraError,
    );
  });
});

describe('entornoConexionPruebas', () => {
  it('vacía DATABASE_URL y separa la URL de pruebas en DB_*', () => {
    expect(entornoConexionPruebas(LOCAL)).toEqual({
      NODE_ENV: 'test',
      DATABASE_URL: '',
      DB_HOST: 'localhost',
      DB_PORT: '5433',
      DB_USERNAME: 'turnify_test',
      DB_PASSWORD: 'turnify_test',
      DB_NAME: 'turnify_test',
    });
  });

  it('decodifica usuario y contraseña con caracteres especiales', () => {
    const env = entornoConexionPruebas('postgresql://us%40r:p%23ss@127.0.0.1/db');
    expect(env.DB_USERNAME).toBe('us@r');
    expect(env.DB_PASSWORD).toBe('p#ss');
    expect(env.DB_PORT).toBe('5432');
  });
});

describe('entornoSinProveedoresExternos', () => {
  it('vacía todas las claves de proveedores externos', () => {
    const env = entornoSinProveedoresExternos();
    expect(Object.keys(env)).toEqual([...CLAVES_PROVEEDORES_EXTERNOS]);
    expect(Object.values(env).every((valor) => valor === '')).toBe(true);
  });
});
