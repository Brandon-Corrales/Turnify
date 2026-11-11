import { describe, expect, it } from 'vitest';
import { enmascararCorreo } from './enmascarar-correo.util';

describe('enmascararCorreo', () => {
  it('enmascara un correo estándar', () => {
    expect(enmascararCorreo('usuario@turnify.com')).toBe('u***@turnify.com');
    expect(enmascararCorreo('admin@dominio.org')).toBe('a***@dominio.org');
  });

  it('maneja correos con prefijo de una sola letra', () => {
    expect(enmascararCorreo('a@turnify.com')).toBe('a@turnify.com');
  });

  it('no falla ante correos nulos, indefinidos o malformados', () => {
    expect(enmascararCorreo('')).toBe('');
    expect(enmascararCorreo(null)).toBe('');
    expect(enmascararCorreo(undefined)).toBe('');
    expect(enmascararCorreo('no-es-correo')).toBe('***@***');
  });
});
