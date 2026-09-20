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
  let service: LimitesPlanService;

  beforeEach(() => {
    negocioRepo = { findOne: vi.fn() };
    usuarioRepo = { count: vi.fn() };
    servicioRepo = { count: vi.fn() };
    reservaRepo = { count: vi.fn() };
    mensajeChatbotRepo = { count: vi.fn() };
    service = new LimitesPlanService(
      negocioRepo as any,
      usuarioRepo as any,
      servicioRepo as any,
      reservaRepo as any,
      mensajeChatbotRepo as any,
    );
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
