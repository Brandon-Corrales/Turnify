import { describe, expect, it } from 'vitest';
import { componerTitulo } from './use-titulo-pagina';

describe('componerTitulo() — Bloque 1, punto 1.6', () => {
  it('agrega la marca después del título de la pantalla', () => {
    expect(componerTitulo('Calendario')).toBe('Calendario · Turnify');
    expect(componerTitulo('Book at Barbería Demo')).toBe('Book at Barbería Demo · Turnify');
  });

  it('sin título (o vacío) deja solo la marca', () => {
    expect(componerTitulo()).toBe('Turnify');
    expect(componerTitulo('  ')).toBe('Turnify');
    expect(componerTitulo(null)).toBe('Turnify');
  });
});
