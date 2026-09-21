import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { AppThrottlerGuard } from './ws-aware-throttler.guard';

function crearGuard() {
  // ThrottlerGuard normalmente se instancia vía DI (opciones, storage,
  // reflector) — aquí no importa porque solo probamos shouldSkip(), que
  // no toca ninguna de esas dependencias.
  return Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
}

describe('AppThrottlerGuard', () => {
  it('se salta el throttling en un contexto WebSocket (el chatbot no tiene res.header)', async () => {
    const guard = crearGuard();
    const contexto = { getType: () => 'ws' } as unknown as ExecutionContext;
    await expect((guard as any).shouldSkip(contexto)).resolves.toBe(true);
  });

  it('no se salta el throttling en un contexto HTTP normal', async () => {
    const guard = crearGuard();
    const contexto = { getType: () => 'http' } as unknown as ExecutionContext;
    await expect((guard as any).shouldSkip(contexto)).resolves.toBe(false);
  });
});
