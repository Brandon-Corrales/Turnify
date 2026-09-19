import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { TenantContextService } from '../../common/tenant';
import { EstadoReserva, RolUsuario } from '../../database/entities';

const NEGOCIO_ID = 'negocio-1';
const USUARIO_ID = 'usuario-1';
const CLIENTE_ID = 'cliente-1';
const SERVICIO_ID = 'servicio-1';

// Un lunes fijo en el futuro, 10:00 hora Costa Rica (UTC-6) → 16:00 UTC.
// dia_semana esperado: 1 (lunes).
const LUNES_10AM_UTC = '2027-03-01T16:00:00.000Z';

function crearManagerMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    query: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((_entity, data) => data),
    save: vi.fn((data) => Promise.resolve({ idReserva: 'reserva-nueva', ...data })),
    update: vi.fn().mockResolvedValue(undefined),
    findOneOrFail: vi.fn().mockResolvedValue({ idReserva: 'reserva-1' }),
    ...overrides,
  };
}

function crearRepoMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ReservasService', () => {
  let managerMock: ReturnType<typeof crearManagerMock>;
  let dataSourceMock: { transaction: (cb: (manager: any) => Promise<any>) => Promise<any> };
  let reservaRepo: ReturnType<typeof crearRepoMock>;
  let clienteRepo: ReturnType<typeof crearRepoMock>;
  let servicioRepo: ReturnType<typeof crearRepoMock>;
  let usuarioRepo: ReturnType<typeof crearRepoMock>;
  let disponibilidadRepo: ReturnType<typeof crearRepoMock>;
  let tenantContext: TenantContextService;
  let service: ReservasService;

  beforeEach(() => {
    managerMock = crearManagerMock();
    dataSourceMock = { transaction: (cb) => cb(managerMock) };
    reservaRepo = crearRepoMock();
    clienteRepo = crearRepoMock({ findOne: vi.fn().mockResolvedValue({ idCliente: CLIENTE_ID }) });
    servicioRepo = crearRepoMock({
      findOne: vi.fn().mockResolvedValue({ idServicio: SERVICIO_ID, duracionMinutos: 60 }),
    });
    usuarioRepo = crearRepoMock({ findOne: vi.fn().mockResolvedValue({ idUsuario: USUARIO_ID }) });
    disponibilidadRepo = crearRepoMock({
      find: vi.fn().mockResolvedValue([{ idDisponibilidad: 'disp-1' }]), // dentro de disponibilidad por defecto
    });
    tenantContext = new TenantContextService();
    service = new ReservasService(
      dataSourceMock as any,
      reservaRepo as any,
      clienteRepo as any,
      servicioRepo as any,
      usuarioRepo as any,
      disponibilidadRepo as any,
      tenantContext,
    );
  });

  function comoAdmin<T>(fn: () => T): T {
    return tenantContext.run({ idNegocio: NEGOCIO_ID, idUsuario: 'admin-1', rol: RolUsuario.ADMIN }, fn);
  }

  const dtoValido = { idCliente: CLIENTE_ID, idServicio: SERVICIO_ID, idUsuario: USUARIO_ID, fechaHoraInicio: LUNES_10AM_UTC };

  it('crear() calcula fechaHoraFin a partir de la duración del servicio', async () => {
    await comoAdmin(() => service.crear(dtoValido));
    const entidadCreada = managerMock.create.mock.calls[0][1];
    expect(entidadCreada.fechaHoraInicio.toISOString()).toBe(LUNES_10AM_UTC);
    expect(entidadCreada.fechaHoraFin.toISOString()).toBe('2027-03-01T17:00:00.000Z'); // +60min
  });

  it('crear() adquiere un advisory lock por usuario antes de chequear traslapes', async () => {
    await comoAdmin(() => service.crear(dtoValido));
    expect(managerMock.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [USUARIO_ID]);
  });

  it('crear() rechaza si el cliente no existe', async () => {
    clienteRepo.findOne.mockResolvedValue(null);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(NotFoundException);
  });

  it('crear() rechaza una fecha en el pasado', async () => {
    await expect(
      comoAdmin(() => service.crear({ ...dtoValido, fechaHoraInicio: '2020-01-01T10:00:00.000Z' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('crear() rechaza si no hay disponibilidad registrada que cubra ese horario', async () => {
    disponibilidadRepo.find.mockResolvedValue([]);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(ConflictException);
  });

  it('crear() rechaza si ya existe una reserva traslapada del mismo usuario (chequeo proactivo)', async () => {
    managerMock.find.mockResolvedValue([{ idReserva: 'reserva-existente' }]);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(ConflictException);
    expect(managerMock.save).not.toHaveBeenCalled();
  });

  it('crear() traduce una violación del EXCLUDE constraint (23P01) en RESERVA_TRASLAPADA', async () => {
    managerMock.save.mockRejectedValue({ code: '23P01' });
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toMatchObject({
      response: { errorCode: 'RESERVA_TRASLAPADA' },
    });
  });

  it('cancelar() marca estado=cancelada', async () => {
    reservaRepo.findOne.mockResolvedValue({ idReserva: 'reserva-1', estado: EstadoReserva.CONFIRMADA });
    await service.cancelar('reserva-1');
    expect(reservaRepo.update).toHaveBeenCalledWith({ idReserva: 'reserva-1' }, { estado: EstadoReserva.CANCELADA });
  });

  it('cancelar() rechaza cancelar una reserva ya cancelada', async () => {
    reservaRepo.findOne.mockResolvedValue({ idReserva: 'reserva-1', estado: EstadoReserva.CANCELADA });
    await expect(service.cancelar('reserva-1')).rejects.toThrow(ConflictException);
  });

  it('reprogramar() rechaza reprogramar una reserva cancelada', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CANCELADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });
    await expect(
      comoAdmin(() => service.reprogramar('reserva-1', { fechaHoraInicio: LUNES_10AM_UTC })),
    ).rejects.toThrow(ConflictException);
  });

  it('reprogramar() excluye la propia reserva del chequeo de traslape', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });
    await comoAdmin(() => service.reprogramar('reserva-1', { fechaHoraInicio: LUNES_10AM_UTC }));
    const filtro = managerMock.find.mock.calls[0][1].where;
    expect(filtro.idReserva).toBeDefined(); // Not('reserva-1')
  });
});
