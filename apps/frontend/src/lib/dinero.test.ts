import { describe, expect, it } from 'vitest';
import { formatearDinero, monedaOPorDefecto, nombreMoneda, simboloMoneda } from './dinero';

// Intl usa espacios especiales (U+00A0 / U+202F) como separador: se normalizan para comparar.
const n = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatearDinero() — Bloque 5, punto 5.2', () => {
  it('CRC en español: sin decimales si es entero, con céntimos exactos si los tiene', () => {
    expect(n(formatearDinero(15000, 'CRC', 'es'))).toBe('₡15 000');
    expect(n(formatearDinero('15000.50', 'CRC', 'es'))).toBe('₡15 000,50');
    expect(n(formatearDinero(0, 'CRC', 'es'))).toBe('₡0');
  });

  it('CRC en inglés: símbolo ₡ (no "CRC")', () => {
    expect(formatearDinero(15000, 'CRC', 'en')).toBe('₡15,000');
    expect(formatearDinero(15000.5, 'CRC', 'en')).toBe('₡15,000.50');
  });

  it('USD en inglés y en español', () => {
    expect(formatearDinero(15, 'USD', 'en')).toBe('$15');
    expect(formatearDinero('15.5', 'USD', 'en')).toBe('$15.50');
    expect(n(formatearDinero(1234.56, 'USD', 'es'))).toBe('$1 234,56');
  });

  it('nunca redondea el monto: lo que se ve es lo guardado', () => {
    expect(formatearDinero(15000.99, 'CRC', 'en')).toBe('₡15,000.99');
    expect(formatearDinero('8000.00', 'CRC', 'en')).toBe('₡8,000');
  });

  it('una moneda desconocida o vacía cae en CRC; un monto no numérico se devuelve tal cual', () => {
    expect(formatearDinero(100, 'EUR', 'en')).toBe('₡100');
    expect(monedaOPorDefecto(undefined)).toBe('CRC');
    expect(formatearDinero('abc', 'USD', 'en')).toBe('abc');
  });

  it('símbolo y nombre traducido para etiquetas y el selector', () => {
    expect(simboloMoneda('CRC', 'es')).toBe('₡');
    expect(simboloMoneda('USD', 'en')).toBe('$');
    expect(nombreMoneda('USD', 'en')).toBe('US Dollar');
    expect(nombreMoneda('CRC', 'es').toLowerCase()).toContain('colón');
  });
});
