import { hoyEnZonaNegocio, instanteLocal } from './fecha-negocio';

export type Periodo = 'esteMes' | 'mesPasado' | 'ultimos3Meses';

/**
 * Rango del período en la zona horaria del NEGOCIO (Bloque 5): del día 1 a
 * las 00:00 locales al último instante del último mes. Antes era en meses UTC,
 * que en Costa Rica empezaban el día anterior a las 18:00.
 */
export function rangoPeriodo(
  periodo: Periodo,
  zona: string,
  ahora: Date = new Date(),
): { desde: string; hasta: string } {
  const [anioActual, mesActual] = hoyEnZonaNegocio(ahora, zona).split('-').map(Number);
  const atras = periodo === 'mesPasado' ? 1 : periodo === 'ultimos3Meses' ? 2 : 0;
  const meses = periodo === 'ultimos3Meses' ? 3 : 1;
  const primerDia = (desplazamiento: number) => {
    const d = new Date(Date.UTC(anioActual, mesActual - 1 + desplazamiento, 1));
    return d.toISOString().slice(0, 10);
  };
  const desde = instanteLocal(primerDia(-atras), '00:00', zona);
  const siguiente = instanteLocal(primerDia(-atras + meses), '00:00', zona);
  return { desde: desde.toISOString(), hasta: new Date(siguiente.getTime() - 1).toISOString() };
}
