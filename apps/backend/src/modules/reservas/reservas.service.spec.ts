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
  let notificaciones: {
    programarConfirmacion: ReturnType<typeof vi.fn>;
    programarCancelacion: ReturnType<typeof vi.fn>;
  };
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
    notificaciones = {
      programarConfirmacion: vi.fn().mockResolvedValue(undefined),
      programarCancelacion: vi.fn().mockResolvedValue(undefined),
    };
    service = new ReservasService(
      dataSourceMock as any,
      reservaRepo as any,
      clienteRepo as any,
      servicioRepo as any,
      usuarioRepo as any,
      disponibilidadRepo as any,
      tenantContext,
      notificaciones as any,
    );
  });

  function comoAdmin<T>(fn: () => T): T {
    return tenantContext.run(
      { idNegocio: NEGOCIO_ID, idUsuario: 'admin-1', rol: RolUsuario.ADMIN },
      fn,
    );
  }

  const dtoValido = {
    idCliente: CLIENTE_ID,
    idServicio: SERVICIO_ID,
    idUsuario: USUARIO_ID,
    fechaHoraInicio: LUNES_10AM_UTC,
  };

  it('crear() calcula fechaHoraFin a partir de la duración del servicio', async () => {
    await comoAdmin(() => service.crear(dtoValido));
    const entidadCreada = managerMock.create.mock.calls[0][1];
    expect(entidadCreada.fechaHoraInicio.toISOString()).toBe(LUNES_10AM_UTC);
    expect(entidadCreada.fechaHoraFin.toISOString()).toBe('2027-03-01T17:00:00.000Z'); // +60min
  });

  it('crear() adquiere un advisory lock por usuario antes de chequear traslapes', async () => {
    await comoAdmin(() => service.crear(dtoValido));
    expect(managerMock.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      USUARIO_ID,
    ]);
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

  it('crear() programa una notificación de confirmación (fuera de la transacción, no bloquea la reserva si fallara)', async () => {
    const reserva = await comoAdmin(() => service.crear(dtoValido));
    expect(notificaciones.programarConfirmacion).toHaveBeenCalledWith(
      reserva,
      expect.objectContaining({ idCliente: CLIENTE_ID }),
      expect.objectContaining({ idServicio: SERVICIO_ID }),
    );
  });

  it('crear() no programa notificación si la reserva no llegó a crearse (traslape)', async () => {
    managerMock.find.mockResolvedValue([{ idReserva: 'reserva-existente' }]);
    await expect(comoAdmin(() => service.crear(dtoValido))).rejects.toThrow(ConflictException);
    expect(notificaciones.programarConfirmacion).not.toHaveBeenCalled();
  });

  it('cancelar() marca estado=cancelada', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
    });
    await service.cancelar('reserva-1');
    expect(reservaRepo.update).toHaveBeenCalledWith(
      { idReserva: 'reserva-1' },
      { estado: EstadoReserva.CANCELADA },
    );
  });

  it('cancelar() programa una notificación de cancelación', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      cliente: { idCliente: CLIENTE_ID },
      servicio: { idServicio: SERVICIO_ID },
    });
    await service.cancelar('reserva-1');
    expect(notificaciones.programarCancelacion).toHaveBeenCalledWith(
      expect.objectContaining({ idReserva: 'reserva-1' }),
      expect.objectContaining({ idCliente: CLIENTE_ID }),
      expect.objectContaining({ idServicio: SERVICIO_ID }),
    );
  });

  it('cancelar() rechaza cancelar una reserva ya cancelada', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CANCELADA,
    });
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

  it('listar() y obtenerUna() piden las relaciones cliente/servicio/usuario (el calendario del frontend las necesita para mostrar algo útil)', async () => {
    await comoAdmin(() => service.listar({ page: 1, limit: 20 } as any));
    expect(reservaRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { cliente: true, servicio: true, usuario: true } }),
    );

    reservaRepo.findOne.mockResolvedValue({ idReserva: 'reserva-1' });
    await service.obtenerUna('reserva-1');
    expect(reservaRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { cliente: true, servicio: true, usuario: true } }),
    );
  });

  it('listar() y obtenerUna() incluyen relaciones con soft-delete (withDeleted) para que el historial no se rompa si el cliente/servicio/usuario se desactiva después', async () => {
    await comoAdmin(() => service.listar({ page: 1, limit: 20 } as any));
    expect(reservaRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );

    reservaRepo.findOne.mockResolvedValue({ idReserva: 'reserva-1' });
    await service.obtenerUna('reserva-1');
    expect(reservaRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
  });

  it('obtenerUna() lanza RESERVA_NO_ENCONTRADA si la reserva no existe', async () => {
    reservaRepo.findOne.mockResolvedValue(null);
    await expect(service.obtenerUna('no-existe')).rejects.toMatchObject({
      response: { errorCode: 'RESERVA_NO_ENCONTRADA' },
    });
  });

  it('cancelar() lanza RESERVA_NO_ENCONTRADA si la reserva no existe', async () => {
    reservaRepo.findOne.mockResolvedValue(null);
    await expect(service.cancelar('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('reprogramar() rechaza si el servicio de la reserva ya no existe', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });
    servicioRepo.findOne.mockResolvedValue(null);

    await expect(
      comoAdmin(() => service.reprogramar('reserva-1', { fechaHoraInicio: LUNES_10AM_UTC })),
    ).rejects.toMatchObject({ response: { errorCode: 'SERVICIO_NO_ENCONTRADO' } });
  });

  it('reprogramar() rechaza una fecha en el pasado', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });

    await expect(
      comoAdmin(() =>
        service.reprogramar('reserva-1', { fechaHoraInicio: '2020-01-01T10:00:00.000Z' }),
      ),
    ).rejects.toMatchObject({ response: { errorCode: 'FECHA_EN_EL_PASADO' } });
  });

  it('reprogramar() rechaza si el nuevo horario cae fuera de la disponibilidad registrada', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });
    disponibilidadRepo.find.mockResolvedValue([]);

    await expect(
      comoAdmin(() => service.reprogramar('reserva-1', { fechaHoraInicio: LUNES_10AM_UTC })),
    ).rejects.toMatchObject({ response: { errorCode: 'FUERA_DE_DISPONIBILIDAD' } });
  });

  it('reprogramar() traduce una violación del EXCLUDE constraint (23P01) en RESERVA_TRASLAPADA', async () => {
    reservaRepo.findOne.mockResolvedValue({
      idReserva: 'reserva-1',
      estado: EstadoReserva.CONFIRMADA,
      idUsuario: USUARIO_ID,
      idServicio: SERVICIO_ID,
    });
    managerMock.update.mockRejectedValue({ code: '23P01' });

    await expect(
      comoAdmin(() => service.reprogramar('reserva-1', { fechaHoraInicio: LUNES_10AM_UTC })),
    ).rejects.toMatchObject({ response: { errorCode: 'RESERVA_TRASLAPADA' } });
  });
});
