import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';

/**
 * Global: toda ruta de la app pasa por TenantContextInterceptor y puede
 * inyectar TenantContextService sin que cada módulo de negocio importe
 * este módulo explícitamente (mismo criterio ya usado para los guards
 * globales de AuthModule). Un módulo de negocio solo necesita su propio
 * `TypeOrmModule.forFeature([Entity])` y `TenantRepositoryProvider(Entity)`
 * en su lista de providers para poder inyectar el repositorio tenant-scoped.
 */
@Global()
@Module({
  providers: [
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [TenantContextService],
})
export class TenantModule {}
