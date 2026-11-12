/**
 * Zona horaria por negocio (Bloque 5, punto 5.1). Las fechas se guardan
 * siempre en UTC; esta zona solo se usa para INTERPRETAR la hora local del
 * negocio: horarios de disponibilidad ("09:00" de un lunes), validación de
 * "fuera de horario", días de la reserva pública, cortes de mes y de día de
 * los límites del plan, agrupación por día de los reportes y la hora escrita
 * en las notificaciones.
 *
 * Usa solo `Intl` (sin librerías): Node trae los datos IANA completos, con
 * horario de verano. Antes era un desfase fijo UTC-6, correcto solo para
 * Costa Rica, que no tiene horario de verano.
 */
export const ZONA_HORARIA_POR_DEFECTO = 'America/Costa_Rica';

/** true si `zona` es un nombre IANA que `Intl` reconoce (p. ej. "America/New_York", "UTC"). */
export function esZonaHorariaValida(zona: unknown): zona is string {
  if (typeof zona !== 'string' || zona.trim() === '' || zona.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** La zona si es válida; si no, Costa Rica (lo que hacía el sistema antes del campo). Nunca la zona del servidor. */
export function zonaOPorDefecto(zona: unknown): string {
  return esZonaHorariaValida(zona) ? zona : ZONA_HORARIA_POR_DEFECTO;
}

interface PartesLocales {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function partesLocales(fecha: Date, zona: string): PartesLocales {
  let fmt = formateadores.get(zona);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formateadores.set(zona, fmt);
  }
  const valor: Record<string, number> = {};
  for (const p of fmt.formatToParts(fecha))
    if (p.type !== 'literal') valor[p.type] = Number(p.value);
  return {
    anio: valor.year,
    mes: valor.month,
    dia: valor.day,
    hora: valor.hour,
    minuto: valor.minute,
    segundo: valor.second,
  };
}

/** Desfase de la zona en ese instante, en minutos (Costa Rica: -360; Nueva York: -300 o -240). */
export function desfaseMinutos(fecha: Date, zona: string): number {
  const p = partesLocales(fecha, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Instante UTC de una hora de reloj local ("YYYY-MM-DD" + "HH:mm") en la zona.
 * - Hora que no existe (salto de primavera, p. ej. 02:30 en Nueva York): se
 *   corre hacia adelante lo que dura el salto (03:30), como hacen los relojes.
 * - Hora repetida (regreso de otoño, p. ej. 01:30): se toma la primera vez.
 */
export function instanteLocal(fechaYYYYMMDD: string, horaMinuto: string, zona: string): Date {
  const [anio, mes, dia] = fechaYYYYMMDD.split('-').map(Number);
  const [hora, minuto] = horaMinuto.split(':').map(Number);
  const relojComoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto);
  // Dos candidatos: con el desfase de unas horas antes y de unas horas
  // después. Cubre cualquier cambio de hora de hasta 3 h.
  const candidatos = [-3, 3].map((h) => {
    const desfase = desfaseMinutos(new Date(relojComoUtc + h * 3_600_000), zona);
    return relojComoUtc - desfase * 60_000;
  });
  const exactos = candidatos
    .filter((c) => {
      const p = partesLocales(new Date(c), zona);
      return (
        p.anio === anio && p.mes === mes && p.dia === dia && p.hora === hora && p.minuto === minuto
      );
    })
    .sort((a, b) => a - b);
  if (exactos.length > 0) return new Date(exactos[0]);
  // No existe en el reloj local: el candidato con el desfase de ANTES del
  // salto cae justo después del salto, en la misma hora de pared corrida.
  return new Date(Math.max(...candidatos));
}

export interface MomentoLocal {
  /** "YYYY-MM-DD" en la zona del negocio */
  fecha: string;
  /** 0 = domingo … 6 = sábado, igual que DISPONIBILIDAD.dia_semana */
  diaSemana: number;
  /** "HH:mm" en la zona del negocio */
  horaMinuto: string;
}

export function aMomentoLocal(fecha: Date, zona: string): MomentoLocal {
  const p = partesLocales(fecha, zona);
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${p.anio}-${dosDigitos(p.mes)}-${dosDigitos(p.dia)}`,
    diaSemana: new Date(Date.UTC(p.anio, p.mes - 1, p.dia)).getUTCDay(),
    horaMinuto: `${dosDigitos(p.hora)}:${dosDigitos(p.minuto)}`,
  };
}

/** Primer instante del día "YYYY-MM-DD" en la zona (00:00, o la primera hora que exista ese día). */
export function inicioDeDiaLocal(fechaYYYYMMDD: string, zona: string): Date {
  return instanteLocal(fechaYYYYMMDD, '00:00', zona);
}

/** Día siguiente a "YYYY-MM-DD", sin depender de la zona. */
export function diaSiguiente(fechaYYYYMMDD: string): string {
  const [a, m, d] = fechaYYYYMMDD.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Inicio del día local en curso (corte diario de los límites del plan). */
export function inicioDelDiaActual(ahora: Date, zona: string): Date {
  return inicioDeDiaLocal(aMomentoLocal(ahora, zona).fecha, zona);
}

/** Inicio del mes local en curso (corte mensual de los límites del plan). */
export function inicioDelMesActual(ahora: Date, zona: string): Date {
  return inicioDeDiaLocal(`${aMomentoLocal(ahora, zona).fecha.slice(0, 7)}-01`, zona);
}

/** Fecha/hora legible en el idioma del cliente y la zona del negocio, para el texto de las notificaciones. */
export function formatearFechaHoraLocal(fecha: Date, idioma: 'es' | 'en', zona: string): string {
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-CR', {
    timeZone: zona,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}
