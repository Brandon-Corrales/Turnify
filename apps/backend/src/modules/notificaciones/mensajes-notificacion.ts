import { I18nService } from 'nestjs-i18n';
import { Idioma, TipoNotificacion } from '../../database/entities';

export interface DatosMensajeReserva {
  nombreServicio: string;
  fechaHoraTexto: string;
}

type TipoMensajeReserva =
  TipoNotificacion.CONFIRMACION | TipoNotificacion.CANCELACION | TipoNotificacion.RECORDATORIO;

const CLAVES: Record<TipoMensajeReserva, { asunto: string; texto: string }> = {
  [TipoNotificacion.CONFIRMACION]: {
    asunto: 'notificaciones.CONFIRMACION_ASUNTO',
    texto: 'notificaciones.CONFIRMACION_TEXTO',
  },
  [TipoNotificacion.CANCELACION]: {
    asunto: 'notificaciones.CANCELACION_ASUNTO',
    texto: 'notificaciones.CANCELACION_TEXTO',
  },
  [TipoNotificacion.RECORDATORIO]: {
    asunto: 'notificaciones.RECORDATORIO_ASUNTO',
    texto: 'notificaciones.RECORDATORIO_TEXTO',
  },
};

/**
 * Vía nestjs-i18n (punto 10 del brief): el mensaje se genera en el
 * idioma preferido del CLIENTE (`idioma`), NUNCA en el del negocio ni en
 * el de la request HTTP que disparó la reserva — por eso `lang` se pasa
 * explícito en vez de dejar que I18nContext.current() resuelva el de la
 * request (que podría ser el idioma del admin creando la reserva, no el
 * del cliente que la recibe).
 */
export function construirMensaje(
  i18n: I18nService,
  tipo: TipoMensajeReserva,
  idioma: Idioma,
  datos: DatosMensajeReserva,
): { asunto: string; texto: string } {
  const claves = CLAVES[tipo];
  return {
    asunto: i18n.translate(claves.asunto, { lang: idioma }),
    texto: i18n.translate(claves.texto, { lang: idioma, args: datos }),
  };
}
