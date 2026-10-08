/**
 * Zona horaria de los negocios. El modelo no guarda una zona por negocio:
 * es la misma decisión fija (Costa Rica, UTC-6 sin horario de verano) que
 * usa el backend en `common/utils/zona-horaria-negocio.ts` para validar
 * disponibilidad y horarios.
 */
export const ZONA_HORARIA_NEGOCIO = 'America/Costa_Rica';

/**
 * "Hoy" como `YYYY-MM-DD` en la zona del negocio, independiente de la zona
 * del navegador. No usar `toISOString().slice(0, 10)`: eso es el día en
 * UTC, que en Costa Rica ya es "mañana" desde las 18:00.
 */
export function hoyEnZonaNegocio(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
