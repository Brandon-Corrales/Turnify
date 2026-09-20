/**
 * El ER no tiene un campo de zona horaria por negocio, y el mercado
 * objetivo del producto es Costa Rica (punto 9 del brief) — que no
 * observa horario de verano, así que un offset fijo UTC-6 es correcto
 * hoy. Si el producto alguna vez soporta negocios fuera de Costa Rica,
 * esto debe volverse un campo configurable por NEGOCIO, no una constante.
 */
const OFFSET_CR_MS = 6 * 60 * 60 * 1000;

export interface MomentoLocalCR {
  /** 0 = domingo … 6 = sábado, igual que DISPONIBILIDAD.dia_semana */
  diaSemana: number;
  /** "HH:mm" en hora local de Costa Rica */
  horaMinuto: string;
}

export function aMomentoLocalCR(fecha: Date): MomentoLocalCR {
  const local = new Date(fecha.getTime() - OFFSET_CR_MS);
  const hora = String(local.getUTCHours()).padStart(2, '0');
  const minuto = String(local.getUTCMinutes()).padStart(2, '0');
  return { diaSemana: local.getUTCDay(), horaMinuto: `${hora}:${minuto}` };
}

/** Inversa de aMomentoLocalCR: medianoche (00:00 hora CR) de un día calendario "YYYY-MM-DD", como instante UTC real. Usado por el wizard de reserva pública para generar horarios candidatos de ese día. */
export function inicioDeDiaLocalCR(fechaYYYYMMDD: string): Date {
  const medianocheUtcIngenua = new Date(`${fechaYYYYMMDD}T00:00:00.000Z`);
  return new Date(medianocheUtcIngenua.getTime() + OFFSET_CR_MS);
}

/** Instante UTC de un "HH:mm" hora local CR dentro del día que empieza en inicioDeDia (ver inicioDeDiaLocalCR). */
export function horaMinutoADate(inicioDeDia: Date, horaMinuto: string): Date {
  const [horas, minutos] = horaMinuto.split(':').map(Number);
  return new Date(inicioDeDia.getTime() + (horas * 60 + minutos) * 60_000);
}

/** Fecha/hora legible en el idioma del cliente, para el texto de las notificaciones (punto 10 del brief). */
export function formatearFechaHoraLocalCR(fecha: Date, idioma: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-CR', {
    timeZone: 'America/Costa_Rica',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}
