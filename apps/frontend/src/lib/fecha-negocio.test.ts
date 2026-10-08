import { describe, expect, it } from 'vitest';
import { hoyEnZonaNegocio, mesYAnioEnZonaNegocio } from './fecha-negocio';

describe('hoyEnZonaNegocio()', () => {
  it('a las 18:00 de Costa Rica (00:00 UTC del día siguiente) sigue siendo el día local', () => {
    expect(hoyEnZonaNegocio(new Date('2026-10-07T00:00:00Z'))).toBe('2026-10-06');
  });

  it('a las 22:22 de Costa Rica (el caso de la prueba de humo) sigue siendo el día local', () => {
    expect(hoyEnZonaNegocio(new Date('2026-10-07T04:22:00Z'))).toBe('2026-10-06');
  });

  it('a las 23:59:59 de Costa Rica todavía es el día local', () => {
    expect(hoyEnZonaNegocio(new Date('2026-10-07T05:59:59Z'))).toBe('2026-10-06');
  });

  it('cambia de día exactamente a la medianoche de Costa Rica (06:00 UTC)', () => {
    expect(hoyEnZonaNegocio(new Date('2026-10-07T06:00:00Z'))).toBe('2026-10-07');
  });

  it('en la tarde de Costa Rica el día local y el UTC coinciden', () => {
    expect(hoyEnZonaNegocio(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-07');
  });

  it('respeta el cambio de mes y de año en hora local', () => {
    expect(hoyEnZonaNegocio(new Date('2027-01-01T03:00:00Z'))).toBe('2026-12-31');
  });
});

describe('mesYAnioEnZonaNegocio()', () => {
  it('en español deja el mes y la preposición en minúscula', () => {
    expect(mesYAnioEnZonaNegocio('es', new Date('2026-10-15T12:00:00Z'))).toBe('octubre de 2026');
  });

  it('en inglés usa el formato natural del idioma', () => {
    expect(mesYAnioEnZonaNegocio('en', new Date('2026-10-15T12:00:00Z'))).toBe('October 2026');
  });

  it('usa el mes de Costa Rica, no el de UTC (31 oct 20:00 CR = 1 nov en UTC)', () => {
    expect(mesYAnioEnZonaNegocio('es', new Date('2026-11-01T02:00:00Z'))).toBe('octubre de 2026');
  });
});
