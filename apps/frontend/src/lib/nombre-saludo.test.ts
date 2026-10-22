import { describe, expect, it } from 'vitest';
import { nombreParaSaludo } from './nombre-saludo';

describe('nombreParaSaludo', () => {
  it.each([
    ['Lic. Ana Pérez', 'Ana'],
    ['Dra. María López', 'María'],
    ['Dr. Juan Solís', 'Juan'],
    ['Ing. Carlos Rojas', 'Carlos'],
    ['M.Sc. Laura Vargas', 'Laura'],
    ['Ana Pérez', 'Ana'],
  ])('obtiene el nombre visible de %s', (nombre, esperado) => {
    expect(nombreParaSaludo(nombre)).toBe(esperado);
  });

  it('quita títulos profesionales encadenados solo al inicio', () => {
    expect(nombreParaSaludo('Dra. Lic. Ana Pérez')).toBe('Ana');
    expect(nombreParaSaludo('Ana Dra. Pérez')).toBe('Ana');
  });
});