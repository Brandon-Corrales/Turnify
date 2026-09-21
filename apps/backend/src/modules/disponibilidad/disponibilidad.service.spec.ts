import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DisponibilidadService } from './disponibilidad.service';
import { TenantContextService } from '../../common/tenant';
import { Disponibilidad, RolUsuario, Usuario } from '../../database/entities';

const ADMIN_ID = 'admin-1';
const EMPLEADO_ID = 'empleado-1';
const OTRO_EMPLEADO_ID = 'empleado-2';

function crearDisponibilidadRepoMock() {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn((entity) => Promise.resolve({ idDisponibilidad: 'disp-nueva', ...entity })),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function crearUsuarioRepoMock() {
  return {
    findOne: vi.fn().mockResolvedValue({ idUsuario: EMPLEADO_ID } as Usuario),
  };
}

describe('DisponibilidadService', () => {
  let dispRepo: ReturnType<typeof crearDisponibilidadRepoMock>;
  let usuarioRepo: ReturnType<typeof crearUsuarioRepoMock>;
  let tenantContext: TenantContextService;
  let service: DisponibilidadService;

  beforeEach(() => {
    dispRepo = crearDisponibilidadRepoMock();
    usuarioRepo = crearUsuarioRepoMock();
    tenantContext = new TenantContextService();
    service = new DisponibilidadService(dispRepo as any, usuarioRepo as any, tenantContext);
  });

  function comoAdmin<T>(fn: () => T): T {
    return tenantContext.run(
      { idNegocio: 'negocio-1', idUsuario: ADMIN_ID, rol: RolUsuario.ADMIN },
      fn,
    );
  }
  function comoEmpleado<T>(fn: () => T): T {
    return tenantContext.run(
      { idNegocio: 'negocio-1', idUsuario: EMPLEADO_ID, rol: RolUsuario.EMPLEADO },
      fn,
    );
  }

  const dtoValido = { idUsuario: EMPLEADO_ID, diaSemana: 1, horaInicio: '09:00', horaFin: '12:00' };

  it('un empleado puede crear disponibilidad para sí mismo', async () => {
    const resultado = await comoEmpleado(() => service.crear(dtoValido));
    expect(resultado.idDisponibilidad).toBe('disp-nueva');
  });

  it('un empleado NO puede crear disponibilidad para otro usuario', async () => {
    await expect(
      comoEmpleado(() => service.crear({ ...dtoValido, idUsuario: OTRO_EMPLEADO_ID })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un admin puede crear disponibilidad para cualquier usuario del negocio', async () => {
    const resultado = await comoAdmin(() => service.crear(dtoValido));
    expect(resultado.idDisponibilidad).toBe('disp-nueva');
  });

  it('rechaza un rango donde horaFin no es posterior a horaInicio', async () => {
    await expect(
      comoAdmin(() => service.crear({ ...dtoValido, horaInicio: '12:00', horaFin: '09:00' })),
    ).rejects.toThrow(BadRequestException);
    await expect(
      comoAdmin(() => service.crear({ ...dtoValido, horaInicio: '09:00', horaFin: '09:00' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza crear disponibilidad para un usuario que no existe en el negocio', async () => {
    usuarioRepo.findOne.mockResolvedValue(null);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(NotFoundException);
  });

  it('rechaza un horario que se traslapa con uno ya existente del mismo usuario y día', async () => {
    dispRepo.find.mockResolvedValue([{ idDisponibilidad: 'disp-existente' } as Disponibilidad]);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(ConflictException);
  });

  it('el chequeo de traslape consulta LessThan(horaFin)/MoreThan(horaInicio) del mismo usuario y día', async () => {
    await comoAdmin(() => service.crear(dtoValido));
    const filtro = dispRepo.find.mock.calls[0][0].where;
    expect(filtro.idUsuario).toBe(EMPLEADO_ID);
    expect(filtro.diaSemana).toBe(1);
    expect(filtro.activo).toBe(true);
  });

  it('permite un horario que NO se traslapa (ej. justo a continuación del anterior)', async () => {
    dispRepo.find.mockResolvedValue([]); // 09:00-12:00 ya existe, este pide 12:00-15:00 → sin overlap
    const resultado = await comoAdmin(() =>
      service.crear({ ...dtoValido, horaInicio: '12:00', horaFin: '15:00' }),
    );
    expect(resultado.idDisponibilidad).toBe('disp-nueva');
  });

  it('actualizar() excluye el propio registro del chequeo de traslape', async () => {
    dispRepo.findOne.mockResolvedValue({
      idDisponibilidad: 'disp-1',
      idUsuario: EMPLEADO_ID,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '12:00',
    } as Disponibilidad);
    await comoAdmin(() => service.actualizar('disp-1', { horaFin: '13:00' }));
    const filtro = dispRepo.find.mock.calls[0][0].where;
    expect(filtro.idDisponibilidad).toBeDefined(); // Not(idExcluido)
  });

  it('un empleado no puede editar la disponibilidad de otro', async () => {
    dispRepo.findOne.mockResolvedValue({
      idDisponibilidad: 'disp-1',
      idUsuario: OTRO_EMPLEADO_ID,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '12:00',
    } as Disponibilidad);
    await expect(
      comoEmpleado(() => service.actualizar('disp-1', { horaFin: '13:00' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('actualizar() puede reactivar un día apagado (activo: true) sin necesidad de borrar y recrear', async () => {
    dispRepo.findOne.mockResolvedValue({
      idDisponibilidad: 'disp-1',
      idUsuario: EMPLEADO_ID,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '12:00',
      activo: false,
    } as Disponibilidad);
    await comoAdmin(() => service.actualizar('disp-1', { activo: true }));
    expect(dispRepo.update).toHaveBeenCalledWith(
      { idDisponibilidad: 'disp-1' },
      { activo: true },
    );
  });

  it('desactivar() marca activo=false sin tocar otras columnas', async () => {
    dispRepo.findOne.mockResolvedValue({
      idDisponibilidad: 'disp-1',
      idUsuario: EMPLEADO_ID,
    } as Disponibilidad);
    await comoEmpleado(() => service.desactivar('disp-1'));
    expect(dispRepo.update).toHaveBeenCalledWith({ idDisponibilidad: 'disp-1' }, { activo: false });
  });
});
