import { Idioma, TipoNotificacion } from '../../database/entities';

export interface DatosMensajeReserva {
  nombreServicio: string;
  fechaHoraTexto: string;
}

/**
 * Diccionario ES/EN mínimo solo para el texto de notificaciones (punto 10
 * del brief: el mensaje se genera en el idioma preferido del CLIENTE,
 * nunca en el del negocio, desde el primer módulo que lo necesite — no se
 * puede esperar a la tarjeta de "i18n backend" para cumplir esto). Cuando
 * se construya esa tarjeta con nestjs-i18n, este archivo se reemplaza por
 * claves de traducción reales sin tocar NotificacionesService.
 */
const PLANTILLAS: Record<
  TipoNotificacion.CONFIRMACION | TipoNotificacion.CANCELACION,
  Record<Idioma, (datos: DatosMensajeReserva) => { asunto: string; texto: string }>
> = {
  [TipoNotificacion.CONFIRMACION]: {
    [Idioma.ES]: ({ nombreServicio, fechaHoraTexto }) => ({
      asunto: 'Reserva confirmada',
      texto: `Tu reserva de "${nombreServicio}" para el ${fechaHoraTexto} quedó confirmada.`,
    }),
    [Idioma.EN]: ({ nombreServicio, fechaHoraTexto }) => ({
      asunto: 'Booking confirmed',
      texto: `Your "${nombreServicio}" appointment on ${fechaHoraTexto} has been confirmed.`,
    }),
  },
  [TipoNotificacion.CANCELACION]: {
    [Idioma.ES]: ({ nombreServicio, fechaHoraTexto }) => ({
      asunto: 'Reserva cancelada',
      texto: `Tu reserva de "${nombreServicio}" para el ${fechaHoraTexto} fue cancelada.`,
    }),
    [Idioma.EN]: ({ nombreServicio, fechaHoraTexto }) => ({
      asunto: 'Booking cancelled',
      texto: `Your "${nombreServicio}" appointment on ${fechaHoraTexto} has been cancelled.`,
    }),
  },
};

export function construirMensaje(
  tipo: TipoNotificacion.CONFIRMACION | TipoNotificacion.CANCELACION,
  idioma: Idioma,
  datos: DatosMensajeReserva,
): { asunto: string; texto: string } {
  return PLANTILLAS[tipo][idioma](datos);
}
