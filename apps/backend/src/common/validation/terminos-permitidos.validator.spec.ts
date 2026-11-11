import { describe, expect, it } from 'vitest';
import { contieneTerminosBloqueados, normalizarTexto } from './terminos-permitidos.validator';

describe('Moderación de términos', () => {
  it('normalizarTexto remueve mayúsculas y acentos', () => {
    expect(normalizarTexto('TÉRMINO Prohibído')).toBe('termino prohibido');
  });

  it('devuelve false si no hay términos configurados o está vacía', () => {
    expect(contieneTerminosBloqueados('cualquier texto', '')).toBe(false);
    expect(contieneTerminosBloqueados('cualquier texto', undefined)).toBe(false);
  });

  it('detecta términos bloqueados de forma insensible a mayúsculas y acentos', () => {
    const lista = 'spam,ofensa,prohibido';
    expect(contieneTerminosBloqueados('Esto es un mensaje con Spam', lista)).toBe(true);
    expect(contieneTerminosBloqueados('Contenido con PROHIBÍDO', lista)).toBe(true);
    expect(contieneTerminosBloqueados('Mensaje totalmente limpio', lista)).toBe(false);
  });

  it('no falla ante valores nulos o indefinidos', () => {
    expect(contieneTerminosBloqueados(null, 'spam')).toBe(false);
    expect(contieneTerminosBloqueados(undefined, 'spam')).toBe(false);
  });
});
