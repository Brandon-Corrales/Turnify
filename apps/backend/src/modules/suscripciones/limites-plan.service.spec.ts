import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LimitesPlanService } from './limites-plan.service';
import { PlanSuscripcion } from '../../database/entities';

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
});
