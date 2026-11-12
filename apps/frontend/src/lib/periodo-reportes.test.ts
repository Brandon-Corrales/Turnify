import { describe, expect, it } from 'vitest';
import { rangoPeriodo } from './periodo-reportes';

describe('rangoPeriodo() — Reportes en la zona del negocio (Bloque 5)', () => {
  it('Costa Rica, este mes: del 1 a las 00:00 locales (06:00 UTC) al último instante del mes', () => {
    expect(rangoPeriodo('esteMes', 'America/Costa_Rica', new Date('2027-03-15T12:00:00Z'))).toEqual(
      {
        desde: '2027-03-01T06:00:00.000Z',
        hasta: '2027-04-01T05:59:59.999Z',
      },
    );
  });

  it('Costa Rica a las 19:00 del 31 de marzo: "este mes" sigue siendo marzo', () => {
    expect(
      rangoPeriodo('esteMes', 'America/Costa_Rica', new Date('2027-04-01T01:00:00Z')).desde,
    ).toBe('2027-03-01T06:00:00.000Z');
  });

  it('Nueva York, mes pasado cruzando el cambio de hora de marzo', () => {
    expect(rangoPeriodo('mesPasado', 'America/New_York', new Date('2027-04-10T12:00:00Z'))).toEqual(
      {
        desde: '2027-03-01T05:00:00.000Z',
        hasta: '2027-04-01T03:59:59.999Z',
      },
    );
  });

  it('últimos 3 meses cruzando el año', () => {
    expect(
      rangoPeriodo('ultimos3Meses', 'America/Costa_Rica', new Date('2027-01-20T12:00:00Z')),
    ).toEqual({ desde: '2026-11-01T06:00:00.000Z', hasta: '2027-02-01T05:59:59.999Z' });
  });
});
