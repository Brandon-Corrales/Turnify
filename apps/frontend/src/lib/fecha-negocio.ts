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

/**
 * Mes y año en el idioma de la interfaz y en la zona del negocio, tal como
 * los da Intl: "octubre de 2026" / "October 2026". Se usa dentro de una
 * frase ("Resumen de octubre de 2026"), así que NO se capitaliza cada
 * palabra: en español el mes y "de" van en minúscula.
 */
export function mesYAnioEnZonaNegocio(idioma: string, fecha: Date = new Date()): string {
  return fecha.toLocaleDateString(idioma.startsWith('en') ? 'en-US' : 'es-CR', {
    timeZone: ZONA_HORARIA_NEGOCIO,
    month: 'long',
    year: 'numeric',
  });
}

/** Desfase fijo de Costa Rica (sin horario de verano), igual que `OFFSET_CR_MS` del backend. */
const OFFSET_ZONA_NEGOCIO = '-06:00';

/** Primer y último instante de un día `YYYY-MM-DD` en la zona del negocio, como ISO UTC para los filtros `desde`/`hasta` del backend. */
function rangoDiaEnZonaNegocio(fecha: string): { desde: string; hasta: string } {
  return {
    desde: new Date(`${fecha}T00:00:00.000${OFFSET_ZONA_NEGOCIO}`).toISOString(),
    hasta: new Date(`${fecha}T23:59:59.999${OFFSET_ZONA_NEGOCIO}`).toISOString(),
  };
}

/** Todos los días (`YYYY-MM-DD`) del mes en curso en la zona del negocio. */
export function diasDelMesEnZonaNegocio(ahora: Date = new Date()): string[] {
  const [anio, mes] = hoyEnZonaNegocio(ahora).split('-').map(Number);
  const totalDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  return Array.from(
    { length: totalDias },
    (_, i) => `${prefijo}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** Rango del mes en curso en la zona del negocio. Con UTC, el mes empezaba el día anterior a las 18:00 hora local. */
export function rangoMesEnZonaNegocio(ahora: Date = new Date()): { desde: string; hasta: string } {
  const dias = diasDelMesEnZonaNegocio(ahora);
  return {
    desde: rangoDiaEnZonaNegocio(dias[0]).desde,
    hasta: rangoDiaEnZonaNegocio(dias[dias.length - 1]).hasta,
  };
}
