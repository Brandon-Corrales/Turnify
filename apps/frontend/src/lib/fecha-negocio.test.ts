import { describe, expect, it } from 'vitest';
import {
  etiquetaDesfase,
  etiquetaZona,
  fechaHoraEnZona,
  hoyEnZonaNegocio,
  instanteLocal,
  mesYAnioEnZonaNegocio,
  rangoDiaEnZonaNegocio,
  rangoMesEnZonaNegocio,
  zonaOPorDefecto,
} from './fecha-negocio';

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

describe('zona del negocio distinta de Costa Rica (Bloque 5, punto 5.1)', () => {
  const NY = 'America/New_York';

  it('hoyEnZonaNegocio usa la zona recibida', () => {
    // 03:30 UTC del 5 de julio: en CR es 4 de julio (21:30); en NY también (23:30)
    expect(hoyEnZonaNegocio(new Date('2027-07-05T03:30:00Z'), NY)).toBe('2027-07-04');
    expect(hoyEnZonaNegocio(new Date('2027-07-05T04:30:00Z'), NY)).toBe('2027-07-05');
  });

  it('instanteLocal convierte con horario de verano y corre la hora inexistente de primavera', () => {
    expect(instanteLocal('2027-03-12', '09:00', NY).toISOString()).toBe('2027-03-12T14:00:00.000Z');
    expect(instanteLocal('2027-03-15', '09:00', NY).toISOString()).toBe('2027-03-15T13:00:00.000Z');
    expect(instanteLocal('2027-03-14', '02:30', NY).toISOString()).toBe('2027-03-14T07:30:00.000Z');
    expect(instanteLocal('2027-11-07', '01:30', NY).toISOString()).toBe('2027-11-07T05:30:00.000Z');
  });

  it('Costa Rica sigue dando lo mismo que el desfase fijo -06:00 anterior', () => {
    expect(instanteLocal('2027-03-01', '19:00').toISOString()).toBe('2027-03-02T01:00:00.000Z');
    expect(rangoDiaEnZonaNegocio('2026-10-06')).toEqual({
      desde: '2026-10-06T06:00:00.000Z',
      hasta: '2026-10-07T05:59:59.999Z',
    });
  });

  it('el día del cambio de hora dura 23 h en NY (rango de 00:00 a 23:59:59.999)', () => {
    const { desde, hasta } = rangoDiaEnZonaNegocio('2027-03-14', NY);
    expect(desde).toBe('2027-03-14T05:00:00.000Z');
    expect(hasta).toBe('2027-03-15T03:59:59.999Z');
  });

  it('rango del mes en NY en noviembre: empieza con horario de verano y termina con el estándar', () => {
    expect(rangoMesEnZonaNegocio(new Date('2027-11-20T12:00:00Z'), NY)).toEqual({
      desde: '2027-11-01T04:00:00.000Z',
      hasta: '2027-12-01T04:59:59.999Z',
    });
  });

  it('fechaHoraEnZona y la etiqueta del selector', () => {
    expect(fechaHoraEnZona(new Date('2027-07-15T14:00:00Z'), NY)).toEqual({
      fecha: '2027-07-15',
      hora: '10:00',
    });
    expect(etiquetaZona('America/Costa_Rica', 'en', new Date('2027-07-15T12:00:00Z'))).toBe(
      'Costa Rica — Central Standard Time (UTC−06:00)',
    );
    expect(etiquetaDesfase(NY, new Date('2027-07-15T12:00:00Z'))).toBe('UTC−04:00');
    expect(etiquetaDesfase(NY, new Date('2027-01-15T12:00:00Z'))).toBe('UTC−05:00');
  });

  it('zonaOPorDefecto nunca devuelve la zona del navegador', () => {
    expect(zonaOPorDefecto(undefined)).toBe('America/Costa_Rica');
    expect(zonaOPorDefecto('No/Existe')).toBe('America/Costa_Rica');
    expect(zonaOPorDefecto(NY)).toBe(NY);
  });
});
