import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * QA (ronda final): este guard corre en TODA request HTTP autenticada
 * del sistema (es el APP_GUARD global) y no tenía ninguna prueba
 * dedicada — a diferencia de WsJwtGuard/LimitePlanGratisGuard, que sí
 * la tienen. Punto 15 del brief: la autenticación es no-negociable.
 */
function crearContexto(opciones: {
  tipo?: 'http' | 'ws';
  esPublico?: boolean;
  authorization?: string;
}) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: opciones.authorization ? { authorization: opciones.authorization } : {},
  };
  const contexto = {
    getType: () => opciones.tipo ?? 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { contexto, request };
}

describe('JwtAuthGuard', () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    configService = { get: vi.fn().mockReturnValue('secreto-fake') };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    guard = new JwtAuthGuard(jwtService as any, configService as any, reflector as any);
  });

  it('deja pasar sin verificar nada en un contexto WebSocket (WsJwtGuard tiene su propia autenticación)', async () => {
    const { contexto } = crearContexto({ tipo: 'ws' });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('deja pasar sin token si el handler está marcado @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { contexto } = crearContexto({});
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rechaza con TOKEN_FALTANTE si no viene header Authorization', async () => {
    const { contexto } = crearContexto({});
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { errorCode: 'TOKEN_FALTANTE' },
    });
  });

  it('rechaza con TOKEN_FALTANTE si el header no es del esquema Bearer', async () => {
    const { contexto } = crearContexto({ authorization: 'Basic algo' });
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { errorCode: 'TOKEN_FALTANTE' },
    });
  });

  it('rechaza con TOKEN_INVALIDO si el JWT no verifica (firma inválida o expirado)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { contexto } = crearContexto({ authorization: 'Bearer token-malo' });
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      response: { errorCode: 'TOKEN_INVALIDO' },
    });
  });

  it('deja pasar y adjunta request.user si el token es válido', async () => {
    const payload = { sub: 'usuario-1', idNegocio: 'negocio-1', rol: 'admin' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const { contexto, request } = crearContexto({ authorization: 'Bearer token-bueno' });

    await expect(guard.canActivate(contexto)).resolves.toBe(true);

    expect(request.user).toEqual(payload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-bueno', {
      secret: 'secreto-fake',
    });
  });
});
