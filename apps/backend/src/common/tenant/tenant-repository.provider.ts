import { Inject, Provider, Type } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { TenantContextService } from './tenant-context.service';
import { TenantScopedRepository } from './tenant-scoped.repository';

const tenantRepositoryToken = (entity: Type<unknown>): string => `Tenant${entity.name}Repository`;

/**
 * Registra un TenantScopedRepository<Entity> como provider, listo para
 * inyectarse con @InjectTenantRepository(Entity). Requiere que el módulo
 * también importe TypeOrmModule.forFeature([Entity]) (misma condición que
 * @InjectRepository).
 *
 * Uso en un módulo de negocio (ej. ClientesModule; TenantModule es
 * @Global(), no hace falta importarlo):
 *   imports: [TypeOrmModule.forFeature([Cliente])],
 *   providers: [ClientesService, TenantRepositoryProvider(Cliente)],
 */
export function TenantRepositoryProvider<T extends ObjectLiteral>(entity: Type<T>): Provider {
  return {
    provide: tenantRepositoryToken(entity),
    useFactory: (repo: Repository<T>, tenantContext: TenantContextService) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new TenantScopedRepository<any>(repo, tenantContext),
    inject: [getRepositoryToken(entity), TenantContextService],
  };
}

export const InjectTenantRepository = (entity: Type<unknown>): ParameterDecorator =>
  Inject(tenantRepositoryToken(entity));
