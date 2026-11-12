import type { EstadoNotificacion, Notificacion } from './notificaciones-api';

/** Aviso que no se envió porque la reserva cambió de hora antes (FALLIDA + REPROGRAMADA). */
export function esAnuladaPorReprogramacion(
  n: Pick<Notificacion, 'estado' | 'ultimoError'>,
): boolean {
  return n.estado === 'fallida' && n.ultimoError === 'REPROGRAMADA';
}

/**
 * true solo si el envío falló de verdad. Cualquier conteo o indicador de
 * fallos debe usar esto en vez de `estado === 'fallida'`.
 */
export function esFalloReal(n: Pick<Notificacion, 'estado' | 'ultimoError'>): boolean {
  return n.estado === 'fallida' && !esAnuladaPorReprogramacion(n);
}

/** Estado que se muestra: las anuladas por reprogramación no se pintan como fallidas. */
export type EstadoVisibleNotificacion = EstadoNotificacion | 'anulada';

export function estadoVisible(
  n: Pick<Notificacion, 'estado' | 'ultimoError'>,
): EstadoVisibleNotificacion {
  return esAnuladaPorReprogramacion(n) ? 'anulada' : n.estado;
}
