import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { construirMensaje } from './mensajes-notificacion';
import { NotificacionesService } from './notificaciones.service';
import { CanalPreferido, Idioma, TipoNegocio, TipoNotificacion } from '../../database/entities';

/**
 * Bloque 4, punto 4.5. La auditoría reportó "60 plantillas de notificación
 * para 9 tipos de negocio; 'otro' no tiene ninguna". Esas 60 filas son la
 * tabla `plantillas_servicio` (servicios sugeridos del onboarding), no
 * plantillas de notificación. Las notificaciones usan UNA plantilla genérica
 * por tipo de notificación e idioma (`src/i18n/{es,en}/notificaciones.json`)
 * y no dependen del tipo de negocio, así que un negocio "otro" recibe las
 * mismas. Estas pruebas leen los archivos reales para demostrarlo.
 */
const leer = (idioma: Idioma): Record<string, string> =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../i18n', idioma, 'notificaciones.json'), 'utf8'),
  );
const PLANTILLAS: Record<Idioma, Record<string, string>> = {
  [Idioma.ES]: leer(Idioma.ES),
  [Idioma.EN]: leer(Idioma.EN),
};

/** I18nService mínimo que traduce con los archivos reales. */
const i18nReal = {
  translate: vi.fn((clave: string, opts: { lang: Idioma; args?: Record<string, string> }) => {
    let texto = PLANTILLAS[opts.lang][clave.replace('notificaciones.', '')];
    if (texto === undefined) throw new Error(`falta la clave ${clave} en ${opts.lang}`);
    for (const [k, v] of Object.entries(opts.args ?? {})) texto = texto.replace(`{${k}}`, v);
    return texto;
  }),
};

const TIPOS = Object.values(TipoNotificacion);
const IDIOMAS = Object.values(Idioma);

describe('plantillas de notificación y el tipo de negocio "otro" (Bloque 4, punto 4.5)', () => {
  it.each(IDIOMAS)(
    'en %s hay asunto y texto para cada tipo de notificación, con los datos de la reserva',
    (idioma) => {
      for (const tipo of TIPOS) {
        const clave = tipo.toUpperCase();
        expect(PLANTILLAS[idioma][`${clave}_ASUNTO`]).toBeTruthy();
        expect(PLANTILLAS[idioma][`${clave}_TEXTO`]).toContain('{nombreServicio}');
        expect(PLANTILLAS[idioma][`${clave}_TEXTO`]).toContain('{fechaHoraTexto}');
      }
    },
  );

  it('las plantillas no dependen del tipo de negocio: no hay ninguna clave por rubro', () => {
    const rubros = Object.values(TipoNegocio);
    for (const idioma of IDIOMAS) {
      for (const clave of Object.keys(PLANTILLAS[idioma])) {
        expect(rubros.some((rubro) => clave.toLowerCase().includes(rubro))).toBe(false);
      }
    }
  });

  it.each(IDIOMAS)(
    'construirMensaje genera los cuatro tipos en %s sin dejar marcadores sin reemplazar',
    (idioma) => {
      for (const tipo of TIPOS) {
        const { asunto, texto } = construirMensaje(i18nReal as any, tipo, idioma, {
          nombreServicio: 'Asesoría',
          fechaHoraTexto: '15 de diciembre, 10:00',
        });
        expect(asunto).not.toBe('');
        expect(texto).toContain('Asesoría');
        expect(texto).not.toMatch(/\{\w+\}/);
      }
    },
  );

  it('un negocio de tipo "otro" programa su confirmación normalmente, en ES y en EN', async () => {
    const insertadas: unknown[][] = [];
    const repo = {
      query: vi.fn(async (_sql: string, params: unknown[]) => {
        insertadas.push(params);
        return [{ id_notificacion: `n-${insertadas.length}` }];
      }),
    };
    const service = new NotificacionesService(
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      i18nReal as any,
    );
    const negocioOtro = { tipoNegocio: TipoNegocio.OTRO };
    const reserva = {
      idReserva: 'reserva-otro',
      fechaHoraInicio: new Date('2027-03-01T16:00:00.000Z'),
      negocio: negocioOtro,
    };

    for (const idiomaPreferido of IDIOMAS) {
      await service.programarConfirmacion(
        reserva as any,
        { idCliente: 'c-1', canalPreferido: CanalPreferido.EMAIL, idiomaPreferido } as any,
        { nombre: 'Asesoría' } as any,
      );
    }

    const [mensajeEs, mensajeEn] = insertadas.map((p) => p[5] as string);
    expect(mensajeEs).toContain('Reserva confirmada');
    expect(mensajeEs).toContain('Asesoría');
    expect(mensajeEn).toContain('Booking confirmed');
    expect(mensajeEn).toContain('Asesoría');
  });
});
