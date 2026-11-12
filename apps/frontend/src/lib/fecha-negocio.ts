/**
 * Fechas en la zona horaria del NEGOCIO (Bloque 5, punto 5.1), nunca en la
 * del navegador de quien mira la pantalla. Misma lógica que
 * `common/utils/zona-horaria-negocio.ts` del backend: solo `Intl`, con
 * horario de verano. Las fechas viajan siempre en UTC (ISO).
 *
 * Todas las funciones reciben la zona como último parámetro; por defecto
 * Costa Rica, que es la zona de los negocios creados antes del campo.
 */
export const ZONA_HORARIA_POR_DEFECTO = 'America/Costa_Rica';

/** Locale de formato según el idioma de la interfaz. */
export function localeDe(idioma: string): string {
  return idioma.startsWith('en') ? 'en-US' : 'es-CR';
}

/** true si `zona` es un nombre IANA que `Intl` reconoce. */
export function esZonaHorariaValida(zona: unknown): zona is string {
  if (typeof zona !== 'string' || zona.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

export function zonaOPorDefecto(zona: unknown): string {
  return esZonaHorariaValida(zona) ? zona : ZONA_HORARIA_POR_DEFECTO;
}

interface Partes {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partes(fecha: Date, zona: string): Partes {
  const valor: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(fecha)) {
    if (p.type !== 'literal') valor[p.type] = Number(p.value);
  }
  return {
    anio: valor.year,
    mes: valor.month,
    dia: valor.day,
    hora: valor.hour,
    minuto: valor.minute,
    segundo: valor.second,
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

function desfaseMinutos(fecha: Date, zona: string): number {
  const p = partes(fecha, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Instante UTC de una hora de reloj local en la zona. Hora inexistente (salto
 * de primavera) → se corre hacia adelante; hora repetida (otoño) → la primera.
 */
export function instanteLocal(
  fecha: string,
  hora: string,
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  const reloj = Date.UTC(anio, mes - 1, dia, h, m);
  const candidatos = [-3, 3].map(
    (horas) => reloj - desfaseMinutos(new Date(reloj + horas * 3_600_000), zona) * 60_000,
  );
  const exactos = candidatos
    .filter((c) => {
      const p = partes(new Date(c), zona);
      return p.anio === anio && p.mes === mes && p.dia === dia && p.hora === h && p.minuto === m;
    })
    .sort((a, b) => a - b);
  return new Date(exactos.length > 0 ? exactos[0] : Math.max(...candidatos));
}

/** Fecha `YYYY-MM-DD` y hora `HH:mm` de un instante en la zona. */
export function fechaHoraEnZona(
  fecha: Date,
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): { fecha: string; hora: string } {
  const p = partes(fecha, zona);
  return {
    fecha: `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`,
    hora: `${dos(p.hora)}:${dos(p.minuto)}`,
  };
}

/**
 * "Hoy" como `YYYY-MM-DD` en la zona del negocio, independiente de la zona
 * del navegador. No usar `toISOString().slice(0, 10)`: eso es el día en
 * UTC, que en Costa Rica ya es "mañana" desde las 18:00.
 */
export function hoyEnZonaNegocio(
  ahora: Date = new Date(),
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): string {
  return fechaHoraEnZona(ahora, zona).fecha;
}

/**
 * Mes y año en el idioma de la interfaz y en la zona del negocio, tal como
 * los da Intl: "octubre de 2026" / "October 2026". Se usa dentro de una
 * frase ("Resumen de octubre de 2026"), así que NO se capitaliza cada
 * palabra: en español el mes y "de" van en minúscula.
 */
export function mesYAnioEnZonaNegocio(
  idioma: string,
  fecha: Date = new Date(),
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): string {
  return fecha.toLocaleDateString(localeDe(idioma), {
    timeZone: zona,
    month: 'long',
    year: 'numeric',
  });
}

function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Primer y último instante de un día `YYYY-MM-DD` en la zona del negocio, como ISO UTC para los filtros `desde`/`hasta` del backend. */
export function rangoDiaEnZonaNegocio(
  fecha: string,
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): { desde: string; hasta: string } {
  const desde = instanteLocal(fecha, '00:00', zona);
  const siguiente = instanteLocal(diaSiguiente(fecha), '00:00', zona);
  return { desde: desde.toISOString(), hasta: new Date(siguiente.getTime() - 1).toISOString() };
}

/** Todos los días (`YYYY-MM-DD`) del mes en curso en la zona del negocio. */
export function diasDelMesEnZonaNegocio(
  ahora: Date = new Date(),
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): string[] {
  const [anio, mes] = hoyEnZonaNegocio(ahora, zona).split('-').map(Number);
  const totalDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = `${anio}-${dos(mes)}`;
  return Array.from({ length: totalDias }, (_, i) => `${prefijo}-${dos(i + 1)}`);
}

/** Rango del mes en curso en la zona del negocio. Con UTC, el mes empezaba el día anterior a las 18:00 hora local. */
export function rangoMesEnZonaNegocio(
  ahora: Date = new Date(),
  zona: string = ZONA_HORARIA_POR_DEFECTO,
): { desde: string; hasta: string } {
  const dias = diasDelMesEnZonaNegocio(ahora, zona);
  return {
    desde: rangoDiaEnZonaNegocio(dias[0], zona).desde,
    hasta: rangoDiaEnZonaNegocio(dias[dias.length - 1], zona).hasta,
  };
}

/** Fecha y hora legibles en el idioma de la interfaz y la zona del negocio. */
export function formatearFechaHoraEnZona(
  iso: string | Date,
  idioma: string,
  zona: string = ZONA_HORARIA_POR_DEFECTO,
  opciones: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Date(iso).toLocaleString(localeDe(idioma), { ...opciones, timeZone: zona });
}

/** Desfase actual de la zona como texto ("UTC−06:00", "UTC−04:00"). */
export function etiquetaDesfase(zona: string, ahora: Date = new Date()): string {
  const total = desfaseMinutos(ahora, zona);
  const signo = total < 0 ? '−' : '+';
  const abs = Math.abs(total);
  return `UTC${signo}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`;
}

/** Ciudad o región de un nombre IANA ("America/Costa_Rica" → "Costa Rica", "America/Argentina/Buenos_Aires" → "Buenos Aires"). */
export function ciudadDeZona(zona: string): string {
  return (zona.split('/').pop() ?? zona).replace(/_/g, ' ');
}

/** Etiqueta legible y traducida de una zona: "Costa Rica — hora estándar central (UTC−06:00)". */
export function etiquetaZona(zona: string, idioma: string, ahora: Date = new Date()): string {
  const nombre = new Intl.DateTimeFormat(localeDe(idioma), {
    timeZone: zona,
    timeZoneName: 'longGeneric',
  })
    .formatToParts(ahora)
    .find((p) => p.type === 'timeZoneName')?.value;
  const desfase = etiquetaDesfase(zona, ahora);
  return nombre && !nombre.startsWith('GMT')
    ? `${ciudadDeZona(zona)} — ${nombre} (${desfase})`
    : `${ciudadDeZona(zona)} (${desfase})`;
}
