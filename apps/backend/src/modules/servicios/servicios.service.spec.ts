import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ServiciosService } from './servicios.service';
import { Servicio } from '../../database/entities';

function crearServicioFalso(overrides: Partial<Servicio> = {}): Servicio {
  return {
    idServicio: 'servicio-1',
    idNegocio: 'negocio-1',
    nombre: 'Corte clásico',
    duracionMinutos: 30,
    precio: '8000.00',
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as Servicio;
}

function crearTenantRepoMock() {
  return {
    findOne: vi.fn(),
    findAndCount: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn((entity) => Promise.resolve({ idServicio: 'servicio-nuevo', ...entity })),
    update: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ServiciosService', () => {
  let repoMock: ReturnType<typeof crearTenantRepoMock>;
  let service: ServiciosService;

  beforeEach(() => {
    repoMock = crearTenantRepoMock();
    service = new ServiciosService(repoMock as any);
  });

  it('crear() convierte el precio numérico del DTO a string con 2 decimales para la columna numeric', async () => {
    await service.crear({ nombre: 'Corte', duracionMinutos: 30, precio: 8000 } as any);
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ precio: '8000.00' }));
  });

  it('crear() conserva decimales exactos del precio (no los trunca ni redondea de más)', async () => {
    await service.crear({ nombre: 'Corte', duracionMinutos: 30, precio: 7999.5 } as any);
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ precio: '7999.50' }));
  });

  it('listar() pagina con skip/take calculados desde page/limit', async () => {
    repoMock.findAndCount.mockResolvedValue([[crearServicioFalso()], 1]);
    const resultado = await service.listar({ page: 1, limit: 20 });
    expect(repoMock.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    expect(resultado.total).toBe(1);
  });

  it('obtenerUno() lanza SERVICIO_NO_ENCONTRADO si no existe', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.obtenerUno('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('actualizar() convierte precio a string solo cuando viene en el DTO', async () => {
    repoMock.findOne.mockResolvedValue(crearServicioFalso());
    await service.actualizar('servicio-1', { precio: 9500 });
    expect(repoMock.update).toHaveBeenCalledWith({ idServicio: 'servicio-1' }, { precio: '9500.00' });
  });

  it('actualizar() sin precio no toca ese campo', async () => {
    repoMock.findOne.mockResolvedValue(crearServicioFalso());
    await service.actualizar('servicio-1', { nombre: 'Corte premium' });
    expect(repoMock.update).toHaveBeenCalledWith({ idServicio: 'servicio-1' }, { nombre: 'Corte premium' });
  });

  it('desactivar() marca activo=false y hace soft delete', async () => {
    repoMock.findOne.mockResolvedValue(crearServicioFalso());
    await service.desactivar('servicio-1');
    expect(repoMock.update).toHaveBeenCalledWith({ idServicio: 'servicio-1' }, { activo: false });
    expect(repoMock.softDelete).toHaveBeenCalledWith({ idServicio: 'servicio-1' });
  });

  it('desactivar() falla si el servicio no existe, sin llegar a softDelete', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.desactivar('inexistente')).rejects.toThrow(NotFoundException);
    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });
});
