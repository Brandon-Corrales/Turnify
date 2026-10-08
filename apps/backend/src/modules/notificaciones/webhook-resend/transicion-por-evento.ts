import { EstadoNotificacion } from '../../../database/entities';
import { MotivoFallo } from '../motivo-fallo';

/** Lo mínimo de un evento de correo de Resend que usa la transición. */
export interface EventoCorreoResend {
  type: string;
  data: { email_id?: string; bounce?: { type?: string } };
}

export interface EstadoActual {
  estado: EstadoNotificacion;
  ultimoError?: string | null;
}

export interface Transicion {
  estado: EstadoNotificacion;
  ultimoError: MotivoFallo | null;
}

/**
 * Qué le hace cada evento del webhook de Resend a una notificación. Función
 * pura (se prueba sin BD). `null` = el evento no cambia nada.
 *
 * Los eventos pueden llegar desordenados o repetidos, así que un evento
 * "más débil" nunca pisa a uno "más fuerte": un `delivered` tardío no
 * borra un rebote ni una queja, y un `delivery_delayed` solo aplica
 * mientras la notificación sigue en "enviada".
 *
 * Nunca se guarda `bounce.message` (texto libre del servidor del
 * destinatario, puede traer su dirección): solo la categoría.
 */
export function transicionPorEvento(
  evento: EventoCorreoResend,
  actual: EstadoActual,
): Transicion | null {
  switch (evento.type) {
    case 'email.delivered':
      if (
        actual.estado === EstadoNotificacion.FALLIDA ||
        actual.ultimoError === MotivoFallo.MARCADO_COMO_SPAM
      ) {
        return null;
      }
      return { estado: EstadoNotificacion.ENTREGADA, ultimoError: null };
    case 'email.delivery_delayed':
      if (actual.estado !== EstadoNotificacion.ENVIADA) return null;
      return { estado: EstadoNotificacion.ENVIADA, ultimoError: MotivoFallo.ENTREGA_DEMORADA };
    case 'email.bounced':
      return {
        estado: EstadoNotificacion.FALLIDA,
        ultimoError:
          evento.data.bounce?.type === 'Permanent'
            ? MotivoFallo.REBOTE_PERMANENTE
            : MotivoFallo.REBOTE_TEMPORAL,
      };
    case 'email.complained':
      // Una queja implica que el correo sí se entregó.
      return { estado: EstadoNotificacion.ENTREGADA, ultimoError: MotivoFallo.MARCADO_COMO_SPAM };
    case 'email.failed':
      return { estado: EstadoNotificacion.FALLIDA, ultimoError: MotivoFallo.RECHAZADO_POR_PROVEEDOR };
    default:
      return null;
  }
}
