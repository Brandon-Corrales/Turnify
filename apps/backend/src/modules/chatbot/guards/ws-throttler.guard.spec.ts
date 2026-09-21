import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ErrorCodeException } from '../../../common/errors/api-error.interface';
import { ChatbotWsThrottlerGuard } from './ws-throttler.guard';

function crearContexto(idSocket: string): ExecutionContext {
  return {
    switchToWs: () => ({ getClient: () => ({ id: idSocket }) }),
  } as unknown as ExecutionContext;
}

describe('ChatbotWsThrottlerGuard', () => {
  let guard: ChatbotWsThrottlerGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    guard = new ChatbotWsThrottlerGuard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite hasta el máximo de mensajes dentro de la misma ventana', () => {
    const contexto = crearContexto('socket-1');
    for (let i = 0; i < 5; i++) {
      expect(guard.canActivate(contexto)).toBe(true);
    }
  });

  it('rechaza el mensaje que excede el máximo dentro de la ventana, con el errorCode estándar', () => {
    const contexto = crearContexto('socket-1');
    for (let i = 0; i < 5; i++) guard.canActivate(contexto);

    expect(() => guard.canActivate(contexto)).toThrowError(ErrorCodeException);
    try {
      guard.canActivate(contexto);
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorCodeException);
      expect((error as ErrorCodeException).errorCode).toBe('DEMASIADAS_SOLICITUDES');
      expect((error as ErrorCodeException).statusCode).toBe(429);
    }
  });

  it('vuelve a permitir mensajes una vez que pasa la ventana de tiempo', () => {
    const contexto = crearContexto('socket-1');
    for (let i = 0; i < 5; i++) guard.canActivate(contexto);
    expect(() => guard.canActivate(contexto)).toThrow();

    vi.advanceTimersByTime(10_001);

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('cuenta cada socket por separado (una conexión abusiva no bloquea a las demás)', () => {
    const contextoA = crearContexto('socket-a');
    const contextoB = crearContexto('socket-b');
    for (let i = 0; i < 5; i++) guard.canActivate(contextoA);

    expect(() => guard.canActivate(contextoA)).toThrow();
    expect(guard.canActivate(contextoB)).toBe(true);
  });

  it('limpiar() resetea el contador de un socket (llamado al desconectar)', () => {
    const contexto = crearContexto('socket-1');
    for (let i = 0; i < 5; i++) guard.canActivate(contexto);
    expect(() => guard.canActivate(contexto)).toThrow();

    guard.limpiar('socket-1');

    expect(guard.canActivate(contexto)).toBe(true);
  });
});
