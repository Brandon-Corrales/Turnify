import { useQuery } from '@tanstack/react-query';
import { negociosApi } from './negocios-api';
import { zonaOPorDefecto } from './fecha-negocio';
import { monedaOPorDefecto, type Moneda } from './dinero';

/**
 * Zona horaria del negocio de la sesión (Bloque 5, punto 5.1). Reusa la
 * misma query que el resto de pantallas (`['negocios', 'mi-negocio']`), así
 * que no agrega peticiones. Mientras carga (o si el backend todavía no manda
 * el campo) usa Costa Rica, la zona de todos los negocios anteriores.
 */
export function useZonaHorariaNegocio(): string {
  const { data } = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });
  return zonaOPorDefecto(data?.zonaHoraria);
}

/** Moneda del negocio de la sesión (Bloque 5, punto 5.2). Misma query; CRC mientras carga. */
export function useMonedaNegocio(): Moneda {
  const { data } = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });
  return monedaOPorDefecto(data?.moneda);
}
