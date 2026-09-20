import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { TenantContextService } from './tenant-context.service';

type ConNegocio = ObjectLiteral & { idNegocio: string };

/**
 * Envuelve un Repository<T> de TypeORM inyectando `idNegocio` del tenant
 * actual en TODA lectura/escritura — el punto único, transversal, que
 * evita que cada servicio tenga que acordarse de filtrar por negocio
 * (punto 1 del brief: "nunca repetido manualmente en cada servicio").
 *
 * Solo aplica a entidades con columna `idNegocio` propia (Usuario,
 * Cliente, Servicio, Reserva, Disponibilidad, Suscripcion). Entidades sin
 * `idNegocio` directo (Notificacion, ExcepcionDisponibilidad) se filtran
 * por join en el servicio de su propio módulo — fuera del alcance de este
 * wrapper genérico.
 */
export class TenantScopedRepository<T extends ConNegocio> {
  constructor(
    private readonly repo: Repository<T>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private withTenant(
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const idNegocio = this.tenantContext.idNegocio;
    if (!where) return { idNegocio } as FindOptionsWhere<T>;
    if (Array.isArray(where)) return where.map((w) => ({ ...w, idNegocio }));
    return { ...where, idNegocio };
  }

  // async a propósito en todos los métodos que devuelven Promise: así, si
  // withTenant()/tenantContext.idNegocio lanza (sin contexto de tenant
  // activo), el error llega como Promise rechazada y no como excepción
  // síncrona — el caller puede confiar en await/.catch() siempre.

  async find(options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repo.find({ ...options, where: this.withTenant(options.where) });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne({ ...options, where: this.withTenant(options.where) });
  }

  async count(options: FindManyOptions<T> = {}): Promise<number> {
    return this.repo.count({ ...options, where: this.withTenant(options.where) });
  }

  /** Para endpoints de listado paginado (find + count en una sola llamada, como Repository.findAndCount). */
  async findAndCount(options: FindManyOptions<T> = {}): Promise<[T[], number]> {
    return this.repo.findAndCount({ ...options, where: this.withTenant(options.where) });
  }

  /** Crea la entidad en memoria con idNegocio ya fijado (no persiste, igual que Repository.create). */
  create(data: DeepPartial<Omit<T, 'idNegocio'>>): T {
    return this.repo.create({ ...data, idNegocio: this.tenantContext.idNegocio } as DeepPartial<T>);
  }

  /** Persiste, forzando idNegocio del tenant actual aunque el entity lo trajera distinto. */
  async save(entity: DeepPartial<T>): Promise<T> {
    return this.repo.save({ ...entity, idNegocio: this.tenantContext.idNegocio } as DeepPartial<T>);
  }

  async update(criteria: FindOptionsWhere<T>, partial: DeepPartial<T>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo.update(this.withTenant(criteria) as any, partial as any);
  }

  async softDelete(criteria: FindOptionsWhere<T>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.repo.softDelete(this.withTenant(criteria) as any);
  }

  /**
   * Para agregaciones (COUNT/SUM/GROUP BY) que los métodos de arriba no
   * cubren — el filtro por tenant se aplica una sola vez aquí, igual que
   * en el resto de este wrapper, para que quien lo use (ej. Reportes)
   * nunca tenga que acordarse de agregar `idNegocio` a mano.
   */
  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repo
      .createQueryBuilder(alias)
      .andWhere(`${alias}.idNegocio = :idNegocio`, { idNegocio: this.tenantContext.idNegocio });
  }
}
