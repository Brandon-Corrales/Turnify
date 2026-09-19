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
