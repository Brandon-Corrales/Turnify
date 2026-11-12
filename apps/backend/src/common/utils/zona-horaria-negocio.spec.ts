import { describe, expect, it } from 'vitest';
import {
  aMomentoLocal,
  desfaseMinutos,
  diaSiguiente,
  esZonaHorariaValida,
  formatearFechaHoraLocal,
  inicioDeDiaLocal,
  inicioDelDiaActual,
  inicioDelMesActual,
  instanteLocal,
} from './zona-horaria-negocio';

const CR = 'America/Costa_Rica';
const NY = 'America/New_York';

describe('zona horaria por negocio (Bloque 5, punto 5.1)', () => {
  describe('esZonaHorariaValida()', () => {
    it.each([CR, NY, 'Europe/Madrid', 'UTC'])('acepta %s', (zona) => {
      expect(esZonaHorariaValida(zona)).toBe(true);
    });
    it.each(['', 'Costa Rica', 'America/Narnia', 'UTC-6', 42, null])('rechaza %s', (zona) => {
      expect(esZonaHorariaValida(zona)).toBe(false);
    });
  });

  describe('Costa Rica (sin horario de verano): mismo resultado que el desfase fijo UTC-6 anterior', () => {
    it('una cita a las 19:00 del lunes en CR es la 01:00 UTC del martes, y sigue siendo lunes en CR', () => {
      const cita = instanteLocal('2027-03-01', '19:00', CR);
      expect(cita.toISOString()).toBe('2027-03-02T01:00:00.000Z');
      expect(aMomentoLocal(cita, CR)).toEqual({
        fecha: '2027-03-01',
        diaSemana: 1,
        horaMinuto: '19:00',
      });
    });

    it('el desfase es -360 en enero y en julio', () => {
      expect(desfaseMinutos(new Date('2027-01-15T12:00:00Z'), CR)).toBe(-360);
      expect(desfaseMinutos(new Date('2027-07-15T12:00:00Z'), CR)).toBe(-360);
    });

    it('inicio del día y día siguiente', () => {
      expect(inicioDeDiaLocal('2027-03-01', CR).toISOString()).toBe('2027-03-01T06:00:00.000Z');
      expect(diaSiguiente('2027-02-28')).toBe('2027-03-01');
    });
  });

  describe('Nueva York (con horario de verano)', () => {
    it('la misma hora de reloj cambia de instante UTC antes y después del cambio de hora', () => {
      expect(instanteLocal('2027-03-12', '09:00', NY).toISOString()).toBe(
        '2027-03-12T14:00:00.000Z',
      );
      expect(instanteLocal('2027-03-15', '09:00', NY).toISOString()).toBe(
        '2027-03-15T13:00:00.000Z',
      );
    });

    it('cambio de primavera (14/03/2027): las 02:30 no existen y se corren a las 03:30', () => {
      const t = instanteLocal('2027-03-14', '02:30', NY);
      expect(t.toISOString()).toBe('2027-03-14T07:30:00.000Z');
      expect(aMomentoLocal(t, NY).horaMinuto).toBe('03:30');
    });

    it('cambio de primavera: el día dura 23 h (medianoche a medianoche)', () => {
      const inicio = inicioDeDiaLocal('2027-03-14', NY);
      const fin = inicioDeDiaLocal('2027-03-15', NY);
      expect((fin.getTime() - inicio.getTime()) / 3_600_000).toBe(23);
    });

    it('cambio de otoño (07/11/2027): las 01:30 se repiten y se toma la primera', () => {
      const t = instanteLocal('2027-11-07', '01:30', NY);
      expect(t.toISOString()).toBe('2027-11-07T05:30:00.000Z');
      expect(desfaseMinutos(t, NY)).toBe(-240);
    });

    it('cambio de otoño: el día dura 25 h', () => {
      const inicio = inicioDeDiaLocal('2027-11-07', NY);
      const fin = inicioDeDiaLocal('2027-11-08', NY);
      expect((fin.getTime() - inicio.getTime()) / 3_600_000).toBe(25);
    });

    it('aMomentoLocal da el día de la semana local: 23:30 del domingo en NY es lunes en UTC', () => {
      const t = new Date('2027-07-05T03:30:00.000Z'); // lunes UTC
      expect(aMomentoLocal(t, NY)).toEqual({
        fecha: '2027-07-04',
        diaSemana: 0,
        horaMinuto: '23:30',
      });
    });
  });

  describe('cortes de día y de mes de los límites del plan', () => {
    it('CR: a las 19:00 del 31 de marzo todavía es marzo (en UTC ya era abril)', () => {
      const ahora = new Date('2027-04-01T01:00:00.000Z');
      expect(inicioDelMesActual(ahora, CR).toISOString()).toBe('2027-03-01T06:00:00.000Z');
      expect(inicioDelDiaActual(ahora, CR).toISOString()).toBe('2027-03-31T06:00:00.000Z');
    });

    it('NY: el mes de noviembre empieza con el desfase de verano y el día del cambio con el de verano', () => {
      expect(inicioDelMesActual(new Date('2027-11-20T12:00:00Z'), NY).toISOString()).toBe(
        '2027-11-01T04:00:00.000Z',
      );
      expect(inicioDelDiaActual(new Date('2027-11-07T12:00:00Z'), NY).toISOString()).toBe(
        '2027-11-07T04:00:00.000Z',
      );
    });
  });

  it('formatearFechaHoraLocal escribe la hora en la zona del negocio', () => {
    const t = new Date('2027-07-15T14:00:00.000Z');
    expect(formatearFechaHoraLocal(t, 'en', CR)).toContain('8:00');
    expect(formatearFechaHoraLocal(t, 'en', NY)).toContain('10:00');
  });
});
