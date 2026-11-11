import { describe, expect, it } from 'vitest';
import { nombreParaSaludo } from './nombre-saludo';

describe('nombreParaSaludo', () => {
  it.each([
    ['Lic. Ana Pérez', 'Ana'],
    ['Licda. Elena Soto', 'Elena'],
    ['Dra. María López', 'María'],
    ['Dr. Juan Solís', 'Juan'],
    ['DR Jose Picado', 'Jose'],
    ['Ing. Carlos Rojas', 'Carlos'],
    ['Arq. Roberto Mora', 'Roberto'],
    ['Abg. Carmen Castro', 'Carmen'],
    ['M.Sc. Laura Vargas', 'Laura'],
    ['Msc Pedro Ramírez', 'Pedro'],
    ['Ana Pérez', 'Ana'],
  ])('obtiene el nombre visible de %s', (nombre, esperado) => {
    expect(nombreParaSaludo(nombre)).toBe(esperado);
  });

  it('quita títulos profesionales encadenados solo al inicio', () => {
    expect(nombreParaSaludo('Dra. Lic. Ana Pérez')).toBe('Ana');
    expect(nombreParaSaludo('Ana Dra. Pérez')).toBe('Ana');
  });
});