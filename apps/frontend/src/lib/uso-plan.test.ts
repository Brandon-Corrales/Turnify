import { describe, expect, it } from 'vitest';
import { resumirUso } from './uso-plan';

const uso = (usadas: number, limite: number | null) => ({
  enPlanGratis: limite !== null,
  reservasMes: { usadas, limite },
});

describe('resumirUso() — indicador de Suscripción (Bloque 4, punto 4.4)', () => {
  it('calcula el porcentaje y marca el límite alcanzado', () => {
    expect(resumirUso(uso(5, 20))).toEqual({
      usadas: 5,
      limite: 20,
      porcentaje: 25,
      alcanzado: false,
    });
    expect(resumirUso(uso(20, 20))).toMatchObject({ porcentaje: 100, alcanzado: true });
  });

  it('nunca pasa de 100 %', () => {
    expect(resumirUso(uso(23, 20))).toMatchObject({ porcentaje: 100, alcanzado: true });
  });

  it('en un plan de pago no hay porcentaje ni límite', () => {
    expect(resumirUso(uso(40, null))).toEqual({
      usadas: 40,
      limite: null,
      porcentaje: null,
      alcanzado: false,
    });
  });
});
