import { Repository } from 'typeorm';
import { Negocio } from '../../database/entities';
import { zonaOPorDefecto } from './zona-horaria-negocio';

/**
 * Zona horaria del negocio (Bloque 5, punto 5.1). Si el negocio no existe o
 * la columna trae un valor que `Intl` no reconoce, se usa Costa Rica, que es
 * lo que hacía el sistema antes de que existiera el campo.
 */
export async function leerZonaHoraria(
  negocioRepo: Pick<Repository<Negocio>, 'findOne'>,
  idNegocio: string,
): Promise<string> {
  const negocio = await negocioRepo.findOne({
    where: { idNegocio },
    select: { idNegocio: true, zonaHoraria: true },
    withDeleted: true,
  });
  return zonaOPorDefecto(negocio?.zonaHoraria);
}
