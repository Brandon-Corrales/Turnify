import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservaPublicaService } from './reserva-publica.service';
import { TenantContextService } from '../../common/tenant';
import { EstadoReserva, OrigenReserva } from '../../database/entities';

const NEGOCIO_ID = 'negocio-1';
const SERVICIO_ID = 'servicio-1';

function crearContexto() {
  const tenantContext = new TenantContextService();

  const negociosService = {
    obtenerMiNegocio: vi.fn().mockResolvedValue({
      idNegocio: NEGOCIO_ID,
      nombre: 'Barbería Demo',
      tipoNegocio: 'barberia',
    }),
  };
  const serviciosService = {
    listar: vi.fn().mockResolvedValue({
      data: [{ idServicio: SERVICIO_ID, nombre: 'Corte', duracionMinutos: 30, precio: '8000.00' }],
      total: 1,
    }),
    obtenerUno: vi
      .fn()
      .mockResolvedValue({ idServicio: SERVICIO_ID, nombre: 'Corte', duracionMinutos: 30 }),
  };
  const clientesService = {
    buscarPorCorreo: vi.fn().mockResolvedValue(null),
    crear: vi.fn().mockResolvedValue({ idCliente: 'cliente-nuevo' }),
  };
  const reservasService = { crear: vi.fn().mockResolvedValue({ idReserva: 'reserva-1' }) };
  const limitesPlan = {
    estaEnPlanGratis: vi.fn().mockResolvedValue(false),
    contar: vi.fn(),
    limite: vi.fn().mockReturnValue(20),
  };
  const i18n = { translate: vi.fn((_key: string, opts: any) => opts.defaultValue) };

  const usuarioRepo = { find: vi.fn().mockResolvedValue([{ idUsuario: 'usuario-1' }]) };
  const disponibilidadRepo = {
    find: vi
      .fn()
      .mockResolvedValue([
        {
          idUsuario: 'usuario-1',
          diaSemana: 0,
          horaInicio: '09:00',
          horaFin: '12:00',
          activo: true,
        },
      ]),
  };
  const reservaRepo = { find: vi.fn().mockResolvedValue([]) };

  const service = new ReservaPublicaService(
    tenantContext,
    negociosService as any,
    serviciosService as any,
    clientesService as any,
    reservasService as any,
    limitesPlan as any,
    i18n as any,
    usuarioRepo as any,
    disponibilidadRepo as any,
    reservaRepo as any,
  );

  return {
    service,
    negociosService,
    serviciosService,
    clientesService,
    reservasService,
    limitesPlan,
    usuarioRepo,
    disponibilidadRepo,
    reservaRepo,
    tenantContext,
  };
}

describe('ReservaPublicaService', () => {
  let ctx: ReturnType<typeof crearContexto>;

  beforeEach(() => {
    ctx = crearContexto();
  });

  it('obtenerNegocio() abre un TenantContext sintético y devuelve solo datos públicos', async () => {
    const negocio = await ctx.service.obtenerNegocio(NEGOCIO_ID);
    expect(negocio).toEqual({
      idNegocio: NEGOCIO_ID,
      nombre: 'Barbería Demo',
      tipoNegocio: 'barberia',
    });
    expect(ctx.tenantContext.hasContext()).toBe(false);
  });

  it('listarServicios() devuelve los servicios activos del negocio', async () => {
    const servicios = await ctx.service.listarServicios(NEGOCIO_ID);
    expect(servicios).toEqual([
      {
        idServicio: SERVICIO_ID,
        nombre: 'Corte',
        descripcion: undefined,
        duracionMinutos: 30,
        precio: '8000.00',
        colorCalendario: undefined,
      },
    ]);
  });

  it('listarHorarios() genera slots dentro de la ventana de disponibilidad, espaciados por la duración del servicio', async () => {
    // 2026-09-20 es domingo (diaSemana 0) — coincide con la disponibilidad mockeada.
    const horarios = await ctx.service.listarHorarios(NEGOCIO_ID, SERVICIO_ID, '2099-01-04');
    // Ventana 09:00-12:00, servicio de 30min → 6 slots: 09:00,09:30,...,11:30
    expect(horarios).toHaveLength(6);
    expect(horarios[0]).toContain('T15:00:00'); // 09:00 CR = 15:00 UTC
  });

  it('listarHorarios() excluye horarios ya reservados por el único usuario disponible', async () => {
    ctx.reservaRepo.find.mockResolvedValue([
      {
        idUsuario: 'usuario-1',
        estado: EstadoReserva.CONFIRMADA,
        fechaHoraInicio: new Date('2099-01-04T15:00:00.000Z'),
        fechaHoraFin: new Date('2099-01-04T15:30:00.000Z'),
      },
    ]);
    const horarios = await ctx.service.listarHorarios(NEGOCIO_ID, SERVICIO_ID, '2099-01-04');
    expect(horarios).toHaveLength(5);
    expect(horarios).not.toContain('2099-01-04T15:00:00.000Z');
  });

  it('crearReserva() asigna un usuario disponible, hace find-or-create de cliente y crea la reserva con origen online', async () => {
    const dto = {
      idServicio: SERVICIO_ID,
      fechaHoraInicio: '2099-01-04T15:00:00.000Z',
      cliente: { nombreCompleto: 'Ana Pérez', correoElectronico: 'ana@example.com' },
    };
    const resultado = await ctx.service.crearReserva(NEGOCIO_ID, dto);

    expect(ctx.clientesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({ correoElectronico: 'ana@example.com' }),
    );
    expect(ctx.reservasService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idCliente: 'cliente-nuevo',
        idUsuario: 'usuario-1',
        origen: OrigenReserva.ONLINE,
      }),
    );
    expect(resultado).toEqual({ idReserva: 'reserva-1' });
  });

  it('crearReserva() reutiliza un cliente existente por correo en vez de crear uno nuevo', async () => {
    ctx.clientesService.buscarPorCorreo.mockResolvedValue({ idCliente: 'cliente-existente' });
    await ctx.service.crearReserva(NEGOCIO_ID, {
      idServicio: SERVICIO_ID,
      fechaHoraInicio: '2099-01-04T15:00:00.000Z',
      cliente: { nombreCompleto: 'Ana Pérez', correoElectronico: 'ana@example.com' },
    });
    expect(ctx.clientesService.crear).not.toHaveBeenCalled();
    expect(ctx.reservasService.crear).toHaveBeenCalledWith(
      expect.objectContaining({ idCliente: 'cliente-existente' }),
    );
  });

  it('crearReserva() lanza 404 HORARIO_NO_DISPONIBLE si ningún usuario está libre en ese horario', async () => {
    ctx.disponibilidadRepo.find.mockResolvedValue([]);
    const promesa = ctx.service.crearReserva(NEGOCIO_ID, {
      idServicio: SERVICIO_ID,
      fechaHoraInicio: '2099-01-04T15:00:00.000Z',
      cliente: { nombreCompleto: 'Ana Pérez', correoElectronico: 'ana@example.com' },
    });
    await expect(promesa).rejects.toBeInstanceOf(NotFoundException);
    await expect(promesa).rejects.toMatchObject({
      response: { errorCode: 'HORARIO_NO_DISPONIBLE' },
    });
  });

  it('crearReserva() bloquea con 403 LIMITE_PLAN_ALCANZADO si el negocio ya llegó al límite de reservas del Plan Gratis', async () => {
    ctx.limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    ctx.limitesPlan.contar.mockResolvedValue(20);
    const promesa = ctx.service.crearReserva(NEGOCIO_ID, {
      idServicio: SERVICIO_ID,
      fechaHoraInicio: '2099-01-04T15:00:00.000Z',
      cliente: { nombreCompleto: 'Ana Pérez', correoElectronico: 'ana@example.com' },
    });
    await expect(promesa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promesa).rejects.toMatchObject({
      response: { errorCode: 'LIMITE_PLAN_ALCANZADO' },
    });
    expect(ctx.reservasService.crear).not.toHaveBeenCalled();
  });
});
