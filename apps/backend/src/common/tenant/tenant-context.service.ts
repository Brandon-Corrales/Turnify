import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RolUsuario } from '../../database/entities';

export interface TenantContext {
  idNegocio: string;
  idUsuario: string;
  rol: RolUsuario;
}

/**
 * Contexto de tenant por request, basado en AsyncLocalStorage (no en un
 * provider request-scoped): se evita el costo de reconstruir todo el grafo
 * de DI en cada request, y el valor viaja automáticamente a través de
 * async/await sin tener que pasarlo explícitamente entre capas.
 *
 * Falla cerrado a propósito: `idNegocio`/`context` lanzan si se llaman
 * fuera de una request autenticada, en vez de devolver `undefined` y
 * arriesgar una query sin filtrar por negocio.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.als.run(context, callback);
  }

  get context(): TenantContext {
    const context = this.als.getStore();
    if (!context) {
      throw new Error(
        'TenantContextService: no hay contexto de negocio activo. ' +
          '¿Se está usando un repositorio tenant-scoped fuera de una request autenticada?',
      );
    }
    return context;
  }

  get idNegocio(): string {
    return this.context.idNegocio;
  }

  hasContext(): boolean {
    return this.als.getStore() !== undefined;
  }
}
