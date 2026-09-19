import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { RolUsuario, Usuario } from '../../database/entities';

function crearUsuarioFalso(overrides: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 'usuario-1',
    idNegocio: 'negocio-1',
    nombreCompleto: 'Juan Pérez',
    correoElectronico: 'juan@turnify.app',
    contrasenaHash: 'hash',
    rol: RolUsuario.EMPLEADO,
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  } as Usuario;
}

function crearTenantRepoMock() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findAndCount: vi.fn(),
    count: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn((entity) => Promise.resolve({ idUsuario: 'usuario-nuevo', ...entity })),
    update: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UsuariosService', () => {
  let repoMock: ReturnType<typeof crearTenantRepoMock>;
  let service: UsuariosService;

  beforeEach(() => {
    repoMock = crearTenantRepoMock();
    service = new UsuariosService(repoMock as any);
  });

  it('crear() hashea la contraseña y nunca la devuelve en la respuesta pública', async () => {
    const resultado = await service.crear({
      nombreCompleto: 'Nuevo',
      correoElectronico: 'nuevo@turnify.app',
      contrasena: 'Turnify123',
      rol: RolUsuario.EMPLEADO,
    });
    expect(repoMock.save).toHaveBeenCalled();
    const entidadCreada = (repoMock.save as any).mock.calls[0][0];
    expect(entidadCreada.contrasenaHash).not.toBe('Turnify123');
    expect(resultado).not.toHaveProperty('contrasenaHash');
  });

  it('crear() traduce una violación de unicidad en EMAIL_YA_REGISTRADO', async () => {
    (repoMock.save as any).mockRejectedValue({ code: '23505' });
    await expect(
      service.crear({
        nombreCompleto: 'Dup',
        correoElectronico: 'dup@turnify.app',
        contrasena: 'Turnify123',
        rol: RolUsuario.EMPLEADO,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('listar() pagina con skip/take calculados desde page/limit', async () => {
    repoMock.findAndCount.mockResolvedValue([[crearUsuarioFalso()], 1]);
    const resultado = await service.listar({ page: 2, limit: 10 });
    expect(repoMock.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(resultado).toEqual(expect.objectContaining({ total: 1, page: 2, limit: 10 }));
  });

  it('obtenerUno() lanza USUARIO_NO_ENCONTRADO si no existe', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.obtenerUno('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('actualizar() permite cambiar el rol de un empleado sin restricción', async () => {
    repoMock.findOne.mockResolvedValue(crearUsuarioFalso({ rol: RolUsuario.EMPLEADO }));
    await service.actualizar('usuario-1', { rol: RolUsuario.ADMIN });
    expect(repoMock.update).toHaveBeenCalledWith({ idUsuario: 'usuario-1' }, { rol: RolUsuario.ADMIN });
  });

  it('actualizar() bloquea degradar al último admin activo del negocio', async () => {
    repoMock.findOne.mockResolvedValue(crearUsuarioFalso({ idUsuario: 'admin-1', rol: RolUsuario.ADMIN }));
    repoMock.count.mockResolvedValue(0); // no hay otros admins activos
    await expect(service.actualizar('admin-1', { rol: RolUsuario.EMPLEADO })).rejects.toThrow(ConflictException);
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('actualizar() permite degradar a un admin si existe otro admin activo', async () => {
    repoMock.findOne.mockResolvedValue(crearUsuarioFalso({ idUsuario: 'admin-1', rol: RolUsuario.ADMIN }));
    repoMock.count.mockResolvedValue(1); // hay otro admin activo
    await service.actualizar('admin-1', { rol: RolUsuario.EMPLEADO });
    expect(repoMock.update).toHaveBeenCalledWith({ idUsuario: 'admin-1' }, { rol: RolUsuario.EMPLEADO });
  });

  it('desactivar() bloquea desactivar al último admin activo', async () => {
    repoMock.findOne.mockResolvedValue(crearUsuarioFalso({ idUsuario: 'admin-1', rol: RolUsuario.ADMIN }));
    repoMock.count.mockResolvedValue(0);
    await expect(service.desactivar('admin-1')).rejects.toThrow(ConflictException);
    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });

  it('desactivar() de un empleado normal actualiza activo=false, limpia el refresh token y hace soft delete', async () => {
    repoMock.findOne.mockResolvedValue(crearUsuarioFalso({ idUsuario: 'emp-1', rol: RolUsuario.EMPLEADO }));
    await service.desactivar('emp-1');
    expect(repoMock.update).toHaveBeenCalledWith(
      { idUsuario: 'emp-1' },
      { activo: false, refreshTokenHash: null },
    );
    expect(repoMock.softDelete).toHaveBeenCalledWith({ idUsuario: 'emp-1' });
  });
});
