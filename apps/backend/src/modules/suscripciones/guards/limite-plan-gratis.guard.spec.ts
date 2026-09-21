import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LimitePlanGratisGuard } from './limite-plan-gratis.guard';
import { LIMITE_PLAN_KEY } from '../decorators/limite-plan.decorator';

const NEGOCIO_ID = 'negocio-1';

function crearContextoHttpMock(recurso?: string) {
  const reflector = { get: vi.fn().mockReturnValue(recurso) } as unknown as Reflector;
  const contexto = {
    getHandler: () => ({}),
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user: { idNegocio: NEGOCIO_ID, sub: 'admin-1', rol: 'admin' } }),
    }),
  } as unknown as ExecutionContext;
  return { reflector, contexto };
}

function crearContextoWsMock(recurso?: string) {
  const reflector = { get: vi.fn().mockReturnValue(recurso) } as unknown as Reflector;
  const contexto = {
    getHandler: () => ({}),
    getType: () => 'ws',
    switchToWs: () => ({
      getClient: () => ({
        data: { user: { idNegocio: NEGOCIO_ID, sub: 'admin-1', rol: 'admin' } },
      }),
    }),
  } as unknown as ExecutionContext;
  return { reflector, contexto };
}

function crearLimitesPlanMock() {
  return {
    estaEnPlanGratis: vi.fn(),
    contar: vi.fn(),
    limite: vi.fn(
      (recurso: string) =>
        ({ usuarios: 1, servicios: 3, reservas: 20, mensajesChatbot: 10 })[recurso]!,
    ),
  };
}

function crearI18nMock() {
  return { translate: vi.fn((_key: string, opts: any) => opts.defaultValue) };
}

describe('LimitePlanGratisGuard', () => {
  let limitesPlan: ReturnType<typeof crearLimitesPlanMock>;
  let i18n: ReturnType<typeof crearI18nMock>;

  function crearGuard(recurso?: string) {
    const { reflector, contexto } = crearContextoHttpMock(recurso);
    const guard = new LimitePlanGratisGuard(reflector, limitesPlan as any, i18n as any);
    return { guard, contexto, reflector };
  }

  beforeEach(() => {
    limitesPlan = crearLimitesPlanMock();
    i18n = crearI18nMock();
  });

  it('permite el paso si el endpoint no tiene @LimitePlan(...)', async () => {
    const { guard, contexto } = crearGuard(undefined);
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(limitesPlan.estaEnPlanGratis).not.toHaveBeenCalled();
  });

  it('permite el paso sin consultar conteos si el negocio ya está en plan de pago', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(false);
    const { guard, contexto } = crearGuard('servicios');
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(limitesPlan.contar).not.toHaveBeenCalled();
  });

  it('bloquea crear un 2do usuario en Plan Gratis (límite: 1)', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(1);
    const { guard, contexto } = crearGuard('usuarios');
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { errorCode: 'LIMITE_PLAN_ALCANZADO' },
    });
  });

  it('permite crear un servicio si hay menos de 3 activos en Plan Gratis', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(2);
    const { guard, contexto } = crearGuard('servicios');
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('bloquea crear un 4to servicio activo en Plan Gratis (límite: 3)', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(3);
    const { guard, contexto } = crearGuard('servicios');
    await expect(guard.canActivate(contexto)).rejects.toThrow(ForbiddenException);
  });

  it('bloquea crear una reserva 21 en el mes en Plan Gratis (límite: 20)', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(20);
    const { guard, contexto } = crearGuard('reservas');
    await expect(guard.canActivate(contexto)).rejects.toThrow(ForbiddenException);
  });

  it('bloquea un 11vo mensaje al chatbot hoy en Plan Gratis (límite: 10)', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(10);
    const { guard, contexto } = crearGuard('mensajesChatbot');
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { errorCode: 'LIMITE_PLAN_ALCANZADO' },
    });
    expect(i18n.translate).toHaveBeenCalledWith(
      'errores.LIMITE_PLAN_MENSAJES_CHATBOT',
      expect.objectContaining({ defaultValue: expect.any(String) }),
    );
  });

  it('lee el idNegocio de request.user en un contexto HTTP', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(0);
    const { guard, contexto } = crearGuard('servicios');
    await guard.canActivate(contexto);
    expect(limitesPlan.estaEnPlanGratis).toHaveBeenCalledWith(NEGOCIO_ID);
  });

  it('lee el idNegocio de client.data.user en un contexto WebSocket (chatbot)', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(true);
    limitesPlan.contar.mockResolvedValue(0);
    const { reflector, contexto } = crearContextoWsMock('mensajesChatbot');
    const guard = new LimitePlanGratisGuard(reflector, limitesPlan as any, i18n as any);
    await guard.canActivate(contexto);
    expect(limitesPlan.estaEnPlanGratis).toHaveBeenCalledWith(NEGOCIO_ID);
  });

  it('lee el mismo recurso que le pasó el reflector con la clave LIMITE_PLAN_KEY', async () => {
    limitesPlan.estaEnPlanGratis.mockResolvedValue(false);
    const { guard, contexto, reflector } = crearGuard('reservas');
    await guard.canActivate(contexto);
    expect(reflector.get).toHaveBeenCalledWith(LIMITE_PLAN_KEY, expect.anything());
  });
});
