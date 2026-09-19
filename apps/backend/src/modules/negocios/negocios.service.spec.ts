import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NegociosService } from './negocios.service';
import { TenantContextService } from '../../common/tenant';
import { Negocio, RolUsuario } from '../../database/entities';

const IDNEGOCIO = 'negocio-1';

function crearNegocioFalso(overrides: Partial<Negocio> = {}): Negocio {
  return {
    idNegocio: IDNEGOCIO,
    nombre: 'Barbería Demo',
    tipoNegocio: 'barberia',
    correoElectronico: 'demo@turnify.app',
    planSuscripcion: 'gratis' as any,
    estado: 'activo',
    fechaRegistro: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as Negocio;
}

describe('NegociosService', () => {
  let repoMock: Repository<Negocio>;
  let tenantContext: TenantContextService;
  let service: NegociosService;

  beforeEach(() => {
    repoMock = {
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as Repository<Negocio>;
    tenantContext = new TenantContextService();
    service = new NegociosService(repoMock, tenantContext);
  });

  function comoNegocioActual<T>(fn: () => T): T {
    return tenantContext.run({ idNegocio: IDNEGOCIO, idUsuario: 'u1', rol: RolUsuario.ADMIN }, fn);
  }

  it('obtenerMiNegocio() consulta solo por el idNegocio del tenant actual', async () => {
    (repoMock.findOne as any).mockResolvedValue(crearNegocioFalso());
    const negocio = await comoNegocioActual(() => service.obtenerMiNegocio());
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { idNegocio: IDNEGOCIO } });
    expect(negocio.idNegocio).toBe(IDNEGOCIO);
  });

  it('obtenerMiNegocio() lanza NEGOCIO_NO_ENCONTRADO si no existe', async () => {
    (repoMock.findOne as any).mockResolvedValue(null);
    await expect(comoNegocioActual(() => service.obtenerMiNegocio())).rejects.toThrow(NotFoundException);
  });

  it('actualizarMiNegocio() solo escribe en el negocio del tenant actual', async () => {
    (repoMock.findOne as any).mockResolvedValue(crearNegocioFalso());
    await comoNegocioActual(() => service.actualizarMiNegocio({ nombre: 'Nuevo nombre' }));
    expect(repoMock.update).toHaveBeenCalledWith({ idNegocio: IDNEGOCIO }, { nombre: 'Nuevo nombre' });
  });

  it('desactivarMiNegocio() marca estado inactivo y hace soft delete, ambos scoped al tenant', async () => {
    (repoMock.findOne as any).mockResolvedValue(crearNegocioFalso());
    await comoNegocioActual(() => service.desactivarMiNegocio());
    expect(repoMock.update).toHaveBeenCalledWith({ idNegocio: IDNEGOCIO }, { estado: 'inactivo' });
    expect(repoMock.softDelete).toHaveBeenCalledWith({ idNegocio: IDNEGOCIO });
  });

  it('sin contexto de tenant activo, cualquier operación falla cerrado', async () => {
    await expect(service.obtenerMiNegocio()).rejects.toThrow(/no hay contexto de negocio activo/i);
  });
});
