import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CambiosInterceptor } from './cambios.interceptor';
import type { TiempoRealGateway } from './tiempo-real.gateway';

function contextoHttp(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CambiosInterceptor', () => {
  let notificarCambio: Mock;
  let interceptor: CambiosInterceptor;
  const ok: CallHandler = { handle: () => of({ ok: true }) };

  beforeEach(() => {
    notificarCambio = vi.fn();
    interceptor = new CambiosInterceptor({ notificarCambio } as unknown as TiempoRealGateway);
  });

  it('avisa al negocio del JWT después de una escritura exitosa', async () => {
    const ctx = contextoHttp({
      method: 'PATCH',
      path: '/reservas/r1/cancelar',
      user: { idNegocio: 'n1' },
      params: {},
    });
    await lastValueFrom(interceptor.intercept(ctx, ok));
    expect(notificarCambio).toHaveBeenCalledWith('n1', { recurso: 'reservas' });
  });

  it('usa :idNegocio de la URL en la reserva pública (sin sesión)', async () => {
    const ctx = contextoHttp({
      method: 'POST',
      path: '/publico/negocios/n2/reservas',
      params: { idNegocio: 'n2' },
    });
    await lastValueFrom(interceptor.intercept(ctx, ok));
    expect(notificarCambio).toHaveBeenCalledWith('n2', { recurso: 'reservas' });
  });

  it('no avisa en lecturas, rutas de sesión ni cuando la request falla', async () => {
    await lastValueFrom(
      interceptor.intercept(
        contextoHttp({ method: 'GET', path: '/reservas', user: { idNegocio: 'n1' } }),
        ok,
      ),
    );
    await lastValueFrom(
      interceptor.intercept(
        contextoHttp({ method: 'POST', path: '/auth/logout', user: { idNegocio: 'n1' } }),
        ok,
      ),
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextoHttp({ method: 'POST', path: '/clientes', user: { idNegocio: 'n1' } }),
          { handle: () => throwError(() => new Error('falla')) },
        ),
      ),
    ).rejects.toThrow('falla');
    expect(notificarCambio).not.toHaveBeenCalled();
  });
});
