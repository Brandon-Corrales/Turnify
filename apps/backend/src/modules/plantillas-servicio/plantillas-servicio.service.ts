import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlantillaServicio, TipoNegocio } from '../../database/entities';

/**
 * Catálogo global de referencia (punto 2 del brief): no tiene idNegocio,
 * así que no usa TenantScopedRepository — mismo caso documentado que
 * NegociosService, pero aquí ni siquiera se filtra por tenant porque el
 * dato no pertenece a ninguno. Solo lectura: no existe un rol superadmin
 * de plataforma que la administre vía API.
 */
@Injectable()
export class PlantillasServicioService {
  constructor(
    @InjectRepository(PlantillaServicio)
    private readonly plantillaRepo: Repository<PlantillaServicio>,
  ) {}

  async listarPorTipoNegocio(tipoNegocio: TipoNegocio): Promise<PlantillaServicio[]> {
    return this.plantillaRepo.find({
      where: { tipoNegocio },
      order: { orden: 'ASC' },
    });
  }
}
