import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlantillasServicioService } from './plantillas-servicio.service';
import { TipoNegocio } from '../../database/entities';

function crearPlantillaRepoMock() {
  return {
    find: vi.fn().mockResolvedValue([]),
  };
}

describe('PlantillasServicioService', () => {
  let repo: ReturnType<typeof crearPlantillaRepoMock>;
  let service: PlantillasServicioService;

  beforeEach(() => {
    repo = crearPlantillaRepoMock();
    service = new PlantillasServicioService(repo as any);
  });

  it('lista por tipoNegocio ordenado por `orden`, sin filtrar por tenant (catálogo global)', async () => {
    await service.listarPorTipoNegocio(TipoNegocio.BARBERIA);

    expect(repo.find).toHaveBeenCalledWith({
      where: { tipoNegocio: TipoNegocio.BARBERIA },
      order: { orden: 'ASC' },
    });
  });
});
