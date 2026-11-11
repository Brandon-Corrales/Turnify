import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';
import {
  avisoAmbienteBaseDatos,
  hostDeConexion,
  opcionesI18n,
  opcionesMigracionesAlArrancar,
} from './ambiente';

describe('opcionesI18n', () => {
  it('activa watch solo en development', () => {
    expect(opcionesI18n('development', '/i18n').loaderOptions).toEqual({
      path: '/i18n',
      watch: true,
    });
    expect(opcionesI18n('production', '/i18n').loaderOptions).toEqual({
      path: '/i18n',
      watch: false,
    });
    expect(opcionesI18n('test', '/i18n').loaderOptions).toEqual({ path: '/i18n', watch: false });
  });

  it('mantiene el español como idioma de respaldo', () => {
    expect(opcionesI18n('production', '/i18n').fallbackLanguage).toBe('es');
  });
});

describe('hostDeConexion', () => {
  it('lee el host de la URL o de DB_HOST', () => {
    expect(hostDeConexion({ url: 'postgresql://u:p@db.proyecto.supabase.co:5432/postgres' })).toBe(
      'db.proyecto.supabase.co',
    );
    expect(hostDeConexion({ host: 'localhost' })).toBe('localhost');
  });

  it('devuelve null si la URL no se puede interpretar', () => {
    expect(hostDeConexion({ url: 'no-es-url' })).toBeNull();
  });
});

describe('avisoAmbienteBaseDatos', () => {
  it('avisa si producción usa una base local', () => {
    expect(avisoAmbienteBaseDatos('production', 'localhost')).toMatch(/NODE_ENV=production.*local/);
  });

  it('avisa si desarrollo o pruebas usan una base remota', () => {
    expect(avisoAmbienteBaseDatos('development', 'db.proyecto.supabase.co')).toMatch(/remota/);
    expect(avisoAmbienteBaseDatos('test', 'db.proyecto.supabase.co')).toMatch(/NODE_ENV=test/);
  });

  it('no avisa en las combinaciones esperadas', () => {
    expect(avisoAmbienteBaseDatos('production', 'db.proyecto.supabase.co')).toBeNull();
    expect(avisoAmbienteBaseDatos('development', '127.0.0.1')).toBeNull();
    expect(avisoAmbienteBaseDatos('test', 'localhost')).toBeNull();
    expect(avisoAmbienteBaseDatos('production', null)).toBeNull();
  });

  it('nunca incluye el host en el mensaje', () => {
    expect(avisoAmbienteBaseDatos('development', 'db.proyecto.supabase.co')).not.toContain(
      'supabase.co',
    );
  });
});

describe('opcionesMigracionesAlArrancar', () => {
  it('desactivado: no carga migraciones', () => {
    expect(opcionesMigracionesAlArrancar(false, '/app/dist')).toEqual({ migrationsRun: false });
  });

  it('activado: apunta a las migraciones compiladas, una transacción por migración', () => {
    expect(opcionesMigracionesAlArrancar(true, '/app/dist')).toEqual({
      migrationsRun: true,
      migrationsTransactionMode: 'each',
      migrations: [path.join('/app/dist', 'database', 'migrations', '*.js')],
    });
  });
});

describe('env.schema — MIGRATIONS_RUN_ON_START', () => {
  const base = { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'r' };

  it('es false por defecto y con valor vacío', () => {
    expect(validateEnv(base).MIGRATIONS_RUN_ON_START).toBe(false);
    expect(validateEnv({ ...base, MIGRATIONS_RUN_ON_START: '' }).MIGRATIONS_RUN_ON_START).toBe(
      false,
    );
  });

  it('solo "true" lo activa', () => {
    expect(validateEnv({ ...base, MIGRATIONS_RUN_ON_START: 'true' }).MIGRATIONS_RUN_ON_START).toBe(
      true,
    );
    expect(validateEnv({ ...base, MIGRATIONS_RUN_ON_START: 'false' }).MIGRATIONS_RUN_ON_START).toBe(
      false,
    );
  });

  it('rechaza valores ambiguos', () => {
    expect(() => validateEnv({ ...base, MIGRATIONS_RUN_ON_START: 'si' })).toThrow(
      /MIGRATIONS_RUN_ON_START/,
    );
  });
});
