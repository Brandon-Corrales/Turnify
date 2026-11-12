import { describe, expect, it } from 'vitest';
import {
  esPaisTelefono,
  normalizarTelefono,
  opcionesPaisesTelefono,
  separarTelefono,
} from './telefono';

describe('teléfono E.164 (Bloque 5, punto 5.3)', () => {
  it('normaliza números de Costa Rica con o sin guion, espacios o prefijo', () => {
    expect(normalizarTelefono('8888-0000')).toBe('+50688880000');
    expect(normalizarTelefono('8888 0000', 'CR')).toBe('+50688880000');
    expect(normalizarTelefono('+506 8888-0000', 'US')).toBe('+50688880000'); // el "+" manda
  });

  it('normaliza otros países con su selector', () => {
    expect(normalizarTelefono('(201) 555-0123', 'US')).toBe('+12015550123');
    expect(normalizarTelefono('612 34 56 78', 'ES')).toBe('+34612345678');
  });

  it('rechaza números inválidos para el país, o vacíos', () => {
    expect(normalizarTelefono('1234', 'CR')).toBeNull();
    expect(normalizarTelefono('88880000', 'US')).toBeNull();
    expect(normalizarTelefono('hola', 'CR')).toBeNull();
    expect(normalizarTelefono('   ')).toBeNull();
  });

  it('separa lo guardado para editarlo, aceptando formatos antiguos', () => {
    expect(separarTelefono('+12015550123')).toEqual({ pais: 'US', numero: '2015550123' });
    expect(separarTelefono('+506 8888-0000')).toEqual({ pais: 'CR', numero: '88880000' });
    expect(separarTelefono('8888-0000')).toEqual({ pais: 'CR', numero: '88880000' });
    expect(separarTelefono('texto viejo')).toEqual({ pais: 'CR', numero: 'texto viejo' });
    expect(separarTelefono(null)).toEqual({ pais: 'CR', numero: '' });
  });

  it('opciones de país traducidas con su prefijo', () => {
    const es = opcionesPaisesTelefono('es');
    const en = opcionesPaisesTelefono('en');
    expect(es.find((o) => o.value === 'CR')?.label).toBe('Costa Rica (+506)');
    expect(es.find((o) => o.value === 'US')?.label).toBe('Estados Unidos (+1)');
    expect(en.find((o) => o.value === 'US')?.label).toBe('United States (+1)');
    expect(es.length).toBeGreaterThan(200);
    expect(esPaisTelefono('CR')).toBe(true);
    expect(esPaisTelefono('XX')).toBe(false);
  });
});
