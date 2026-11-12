import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LimitesPlanService } from './limites-plan.service';
import { FindOperator } from 'typeorm';
import { EstadoReserva, PlanSuscripcion } from '../../database/entities';
import { SuscripcionesService } from './suscripciones.service';
import { TenantContextService } from '../../common/tenant';
import { RolUsuario } from '../../database/entities';

const NEGOCIO_ID = 'negocio-1';

describe('LimitesPlanService', () => {
  let negocioRepo: { findOne: ReturnType<typeof vi.fn> };
  let usuarioRepo: { count: ReturnType<typeof vi.fn> };
  let servicioRepo: { count: ReturnType<typeof vi.fn> };
  let reservaRepo: { count: ReturnType<typeof vi.fn> };
  let mensajeChatbotRepo: { count: ReturnType<typeof vi.fn> };
  let i18n: { translate: ReturnType<typeof vi.fn> };
  let service: LimitesPlanService;

  beforeEach(() => {
    negocioRepo = { findOne: vi.fn() };
    usuarioRepo = { count: vi.fn() };
    servicioRepo = { count: vi.fn() };
    reservaRepo = { count: vi.fn() };
    mensajeChatbotRepo = { count: vi.fn() };
    i18n = { translate: vi.fn((_clave: string, opts: any) => opts.defaultValue) };
    service = new LimitesPlanService(
      negocioRepo as any,
      usuarioRepo as any,
      servicioRepo as any,
      reservaRepo as any,
      mensajeChatbotRepo as any,
      i18n as any,
    );
  });

  describe('asegurarDentroDelLimite() — chequeo atómico dentro de la transacción', () => {
    function crearManagerMock(plan: PlanSuscripcion, conteo: number) {
      const llamadas: string[] = [];
      const manager = {
        query: vi.fn(async (sql: string) => {
          llamadas.push(sql.includes('pg_advisory_xact_lock') ? 'lock' : sql);
        }),
        getRepository: vi.fn(() => ({
          findOne: vi.fn(async () => ({ planSuscripcion: plan })),
          count: vi.fn(async () => {
            llamadas.push('count');
            return conteo;
          }),
        })),
      };
      return { manager, llamadas };
    }

    it('toma el advisory lock por (recurso, negocio) ANTES de contar', async () => {
      const { manager, llamadas } = crearManagerMock(PlanSuscripcion.GRATIS, 2);
      await service.asegurarDentroDelLimite(manager as any, 'servicios', NEGOCIO_ID);
      expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `limite-plan:servicios:${NEGOCIO_ID}`,
      ]);
      expect(llamadas).toEqual(['lock', 'count']);
    });

    it('lanza LIMITE_PLAN_ALCANZADO con el mensaje traducido del recurso', async () => {
      const { manager } = crearManagerMock(PlanSuscripcion.GRATIS, 3);
      await expect(
        service.asegurarDentroDelLimite(manager as any, 'servicios', NEGOCIO_ID),
      ).rejects.toMatchObject({ response: { errorCode: 'LIMITE_PLAN_ALCANZADO' } });
      expect(i18n.translate).toHaveBeenCalledWith(
        'errores.LIMITE_PLAN_SERVICIOS',
        expect.objectContaining({ defaultValue: expect.any(String) }),
      );
    });

    it('en un plan de pago no toma lock ni cuenta', async () => {
      const { manager, llamadas } = crearManagerMock(PlanSuscripcion.BASICO, 99);
      await service.asegurarDentroDelLimite(manager as any, 'usuarios', NEGOCIO_ID);
      expect(manager.query).not.toHaveBeenCalled();
      expect(llamadas).toEqual([]);
    });
  });

  it('estaEnPlanGratis() es true cuando el negocio tiene plan gratis', async () => {
    negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.GRATIS });
    await expect(service.estaEnPlanGratis(NEGOCIO_ID)).resolves.toBe(true);
  });

  it('estaEnPlanGratis() es false cuando el negocio tiene un plan de pago', async () => {
    negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.BASICO });
    await expect(service.estaEnPlanGratis(NEGOCIO_ID)).resolves.toBe(false);
  });

  it('contar("usuarios") cuenta solo usuarios activos del negocio', async () => {
    usuarioRepo.count.mockResolvedValue(1);
    await expect(service.contar('usuarios', NEGOCIO_ID)).resolves.toBe(1);
    expect(usuarioRepo.count).toHaveBeenCalledWith({
      where: { idNegocio: NEGOCIO_ID, activo: true },
    });
  });

  it('contar("servicios") cuenta solo servicios activos del negocio', async () => {
    servicioRepo.count.mockResolvedValue(2);
    await expect(service.contar('servicios', NEGOCIO_ID)).resolves.toBe(2);
    expect(servicioRepo.count).toHaveBeenCalledWith({
      where: { idNegocio: NEGOCIO_ID, activo: true },
    });
  });

  it('contar("reservas") cuenta reservas del negocio desde el inicio del mes calendario', async () => {
    reservaRepo.count.mockResolvedValue(20);
    await expect(service.contar('reservas', NEGOCIO_ID)).resolves.toBe(20);
    expect(reservaRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idNegocio: NEGOCIO_ID }) }),
    );
  });

  it('contar("mensajesChatbot") cuenta mensajes del negocio desde el inicio del día calendario', async () => {
    mensajeChatbotRepo.count.mockResolvedValue(4);
    await expect(service.contar('mensajesChatbot', NEGOCIO_ID)).resolves.toBe(4);
    expect(mensajeChatbotRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idNegocio: NEGOCIO_ID }) }),
    );
  });

  it('limite() devuelve los valores del punto 5.1 del brief', () => {
    expect(service.limite('usuarios')).toBe(1);
    expect(service.limite('servicios')).toBe(3);
    expect(service.limite('reservas')).toBe(20);
    expect(service.limite('mensajesChatbot')).toBe(10);
  });

  describe('las canceladas no cuentan para el límite de reservas (Bloque 4, punto 4.4)', () => {
    interface ReservaFalsa {
      idNegocio: string;
      estado: EstadoReserva;
      creadoEn: Date;
      fechaHoraInicio: Date;
    }
    let reservas: ReservaFalsa[];

    /** Evalúa el `where` real que arma contar() (igualdad, Not y MoreThanOrEqual). */
    function cumple(valor: unknown, condicion: unknown): boolean {
      if (condicion instanceof FindOperator) {
        if (condicion.type === 'not') return !cumple(valor, condicion.value);
        if (condicion.type === 'moreThanOrEqual')
          return (valor as Date).getTime() >= (condicion.value as Date).getTime();
        throw new Error(`operador no simulado: ${condicion.type}`);
      }
      return valor === condicion;
    }
    const contarEnMemoria = async ({ where }: { where: Record<string, unknown> }) =>
      reservas.filter((r) =>
        Object.entries(where).every(([campo, cond]) => cumple((r as any)[campo], cond)),
      ).length;

    const nueva = (estado = EstadoReserva.CONFIRMADA, creadoEn = new Date()): ReservaFalsa => ({
      idNegocio: NEGOCIO_ID,
      estado,
      creadoEn,
      fechaHoraInicio: new Date(Date.now() + 86_400_000),
    });

    /** Manager mínimo para asegurarDentroDelLimite(): plan gratis + conteo en memoria. */
    const manager = () => ({
      query: vi.fn(),
      getRepository: vi.fn((entidad: { name: string }) =>
        entidad.name === 'Negocio'
          ? { findOne: vi.fn().mockResolvedValue({ planSuscripcion: PlanSuscripcion.GRATIS }) }
          : { count: vi.fn(contarEnMemoria) },
      ),
    });

    beforeEach(() => {
      reservas = [];
      reservaRepo.count.mockImplementation(contarEnMemoria);
    });

    it('cuenta confirmadas, pendientes y ausentes del mes, pero no las canceladas ni las de meses anteriores', async () => {
      const mesPasado = new Date();
      mesPasado.setUTCMonth(mesPasado.getUTCMonth() - 1, 1);
      reservas.push(
        nueva(EstadoReserva.CONFIRMADA),
        nueva(EstadoReserva.PENDIENTE),
        nueva(EstadoReserva.AUSENTE),
        nueva(EstadoReserva.CANCELADA),
        nueva(EstadoReserva.CONFIRMADA, mesPasado),
      );
      reservas.push({ ...nueva(), idNegocio: 'otro-negocio' });
      await expect(service.contar('reservas', NEGOCIO_ID)).resolves.toBe(3);
    });

    it('con 20 reservas activas la 21 se bloquea; cancelar una libera el cupo', async () => {
      reservas.push(...Array.from({ length: 20 }, () => nueva()));
      await expect(
        service.asegurarDentroDelLimite(manager() as any, 'reservas', NEGOCIO_ID),
      ).rejects.toMatchObject({ response: { errorCode: 'LIMITE_PLAN_ALCANZADO' } });

      reservas[0].estado = EstadoReserva.CANCELADA;

      await expect(
        service.asegurarDentroDelLimite(manager() as any, 'reservas', NEGOCIO_ID),
      ).resolves.toBeUndefined();
    });

    it('reprogramar (cambiar la hora) no cambia el conteo', async () => {
      reservas.push(nueva(), nueva());
      const antes = await service.contar('reservas', NEGOCIO_ID);
      reservas[0].fechaHoraInicio = new Date(Date.now() + 5 * 86_400_000);
      await expect(service.contar('reservas', NEGOCIO_ID)).resolves.toBe(antes);
    });

    it('el indicador de Suscripción usa exactamente el mismo conteo que el límite', async () => {
      reservas.push(nueva(), nueva(), nueva(EstadoReserva.CANCELADA));
      negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.GRATIS });
      const tenant = new TenantContextService();
      const suscripciones = new SuscripcionesService(
        {} as any,
        {} as any,
        tenant,
        {} as any,
        service,
      );
      const contar = vi.spyOn(service, 'contar');

      const uso = await tenant.run(
        { idNegocio: NEGOCIO_ID, idUsuario: 'admin-1', rol: RolUsuario.ADMIN },
        () => suscripciones.obtenerUso(),
      );

      expect(contar).toHaveBeenCalledWith('reservas', NEGOCIO_ID);
      expect(uso).toEqual({ enPlanGratis: true, reservasMes: { usadas: 2, limite: 20 } });
      expect(uso.reservasMes.usadas).toBe(await service.contar('reservas', NEGOCIO_ID));
    });

    it('en un plan de pago el indicador no tiene techo (limite null)', async () => {
      reservas.push(nueva());
      negocioRepo.findOne.mockResolvedValue({ planSuscripcion: PlanSuscripcion.BASICO });
      const tenant = new TenantContextService();
      const suscripciones = new SuscripcionesService(
        {} as any,
        {} as any,
        tenant,
        {} as any,
        service,
      );
      const uso = await tenant.run(
        { idNegocio: NEGOCIO_ID, idUsuario: 'admin-1', rol: RolUsuario.ADMIN },
        () => suscripciones.obtenerUso(),
      );
      expect(uso).toEqual({ enPlanGratis: false, reservasMes: { usadas: 1, limite: null } });
    });
  });

  describe('cortes de mes y de día en la zona del negocio (Bloque 5)', () => {
    let filas: Array<{ idNegocio: string; creadoEn: Date; estado?: EstadoReserva }>;
    const contarDesde = async ({ where }: { where: Record<string, any> }) =>
      filas.filter(
        (f) =>
          f.idNegocio === where.idNegocio &&
          f.creadoEn.getTime() >= (where.creadoEn as FindOperator<Date>).value.getTime() &&
          (where.estado === undefined || f.estado !== EstadoReserva.CANCELADA),
      ).length;
    const fila = (iso: string) => ({
      idNegocio: NEGOCIO_ID,
      creadoEn: new Date(iso),
      estado: EstadoReserva.CONFIRMADA,
    });
    const enZona = (zonaHoraria: string) =>
      negocioRepo.findOne.mockResolvedValue({
        zonaHoraria,
        planSuscripcion: PlanSuscripcion.GRATIS,
      });

    beforeEach(() => {
      filas = [];
      reservaRepo.count.mockImplementation(contarDesde);
      mensajeChatbotRepo.count.mockImplementation(contarDesde);
    });
    afterEach(() => vi.useRealTimers());

    it('Costa Rica: el 31 de marzo a las 19:00 todavía es marzo (con UTC ya contaba abril y el cupo se reiniciaba)', async () => {
      vi.useFakeTimers({ now: new Date('2027-04-01T01:00:00.000Z') });
      enZona('America/Costa_Rica');
      filas.push(
        fila('2027-03-01T06:30:00.000Z'), // 1 de marzo 00:30 CR → marzo
        fila('2027-03-31T23:00:00.000Z'), // 31 de marzo 17:00 CR → marzo
        fila('2027-03-01T05:00:00.000Z'), // 28 de febrero 23:00 CR → febrero
      );
      await expect(service.contar('reservas', NEGOCIO_ID)).resolves.toBe(2);
    });

    it('Nueva York: el mes de noviembre empieza a las 04:00 UTC (todavía con horario de verano)', async () => {
      vi.useFakeTimers({ now: new Date('2027-11-20T12:00:00.000Z') });
      enZona('America/New_York');
      filas.push(
        fila('2027-11-01T04:30:00.000Z'), // 1 de nov 00:30 NY → cuenta
        fila('2027-11-01T03:30:00.000Z'), // 31 de oct 23:30 NY → no cuenta
      );
      await expect(service.contar('reservas', NEGOCIO_ID)).resolves.toBe(1);
    });

    it('chatbot en Costa Rica: el día no se corta a las 18:00 locales (las 00:00 UTC)', async () => {
      vi.useFakeTimers({ now: new Date('2027-03-10T02:00:00.000Z') }); // 9 de marzo 20:00 CR
      enZona('America/Costa_Rica');
      filas.push(
        fila('2027-03-09T20:00:00.000Z'), // 9 de marzo 14:00 CR → hoy
        fila('2027-03-10T01:00:00.000Z'), // 9 de marzo 19:00 CR → hoy
        fila('2027-03-09T05:00:00.000Z'), // 8 de marzo 23:00 CR → ayer
      );
      await expect(service.contar('mensajesChatbot', NEGOCIO_ID)).resolves.toBe(2);
    });

    it('chatbot en Nueva York el día del cambio de hora: el día empieza a las 05:00 UTC', async () => {
      vi.useFakeTimers({ now: new Date('2027-03-14T20:00:00.000Z') });
      enZona('America/New_York');
      filas.push(
        fila('2027-03-14T05:10:00.000Z'), // 14 de marzo 00:10 EST → hoy
        fila('2027-03-14T04:50:00.000Z'), // 13 de marzo 23:50 → ayer
      );
      await expect(service.contar('mensajesChatbot', NEGOCIO_ID)).resolves.toBe(1);
    });

    it('el límite del chatbot sigue siendo 10 por día', () => {
      expect(service.limite('mensajesChatbot')).toBe(10);
    });
  });
});
