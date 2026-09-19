import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Cliente, NivelCliente } from '../../database/entities';

function crearClienteFalso(overrides: Partial<Cliente> = {}): Cliente {
  return {
    idCliente: 'cliente-1',
    idNegocio: 'negocio-1',
    nombreCompleto: 'María Rodríguez',
    correoElectronico: 'maria@example.com',
    nivelCliente: NivelCliente.GRATIS,
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as Cliente;
}

function crearTenantRepoMock() {
  return {
    findOne: vi.fn(),
    findAndCount: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn((entity) => Promise.resolve({ idCliente: 'cliente-nuevo', ...entity })),
    update: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ClientesService', () => {
  let repoMock: ReturnType<typeof crearTenantRepoMock>;
  let service: ClientesService;

  beforeEach(() => {
    repoMock = crearTenantRepoMock();
    service = new ClientesService(repoMock as any);
  });

  it('crear() persiste el cliente tal cual llega en el DTO', async () => {
    const dto = { nombreCompleto: 'Nuevo Cliente', correoElectronico: 'nuevo@example.com' };
    const resultado = await service.crear(dto as any);
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining(dto));
    expect(resultado.idCliente).toBe('cliente-nuevo');
  });

  it('crear() traduce una violación de unicidad en CLIENTE_CORREO_YA_REGISTRADO', async () => {
    repoMock.save.mockRejectedValue({ code: '23505' });
    await expect(
      service.crear({ nombreCompleto: 'Dup', correoElectronico: 'dup@example.com' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('listar() pagina con skip/take calculados desde page/limit', async () => {
    repoMock.findAndCount.mockResolvedValue([[crearClienteFalso()], 1]);
    const resultado = await service.listar({ page: 3, limit: 5 });
    expect(repoMock.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    expect(resultado).toEqual(expect.objectContaining({ total: 1, page: 3, limit: 5 }));
  });

  it('obtenerUno() lanza CLIENTE_NO_ENCONTRADO si no existe', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.obtenerUno('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('actualizar() valida existencia antes de escribir y devuelve el cliente actualizado', async () => {
    repoMock.findOne.mockResolvedValue(crearClienteFalso());
    await service.actualizar('cliente-1', { nombreCompleto: 'Cambiado' });
    expect(repoMock.update).toHaveBeenCalledWith({ idCliente: 'cliente-1' }, { nombreCompleto: 'Cambiado' });
  });

  it('actualizar() traduce una violación de unicidad al cambiar el correo', async () => {
    repoMock.findOne.mockResolvedValue(crearClienteFalso());
    repoMock.update.mockRejectedValue({ code: '23505' });
    await expect(service.actualizar('cliente-1', { correoElectronico: 'otro@example.com' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('desactivar() marca activo=false y hace soft delete', async () => {
    repoMock.findOne.mockResolvedValue(crearClienteFalso());
    await service.desactivar('cliente-1');
    expect(repoMock.update).toHaveBeenCalledWith({ idCliente: 'cliente-1' }, { activo: false });
    expect(repoMock.softDelete).toHaveBeenCalledWith({ idCliente: 'cliente-1' });
  });

  it('desactivar() falla si el cliente no existe, sin llegar a softDelete', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.desactivar('inexistente')).rejects.toThrow(NotFoundException);
    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });
});
