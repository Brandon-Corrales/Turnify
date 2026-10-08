import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  InjectTenantRepository,
  TenantContextService,
  TenantScopedRepository,
} from '../../common/tenant';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import { Servicio } from '../../database/entities';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';
import { LimitesPlanService } from '../suscripciones/limites-plan.service';

@Injectable()
export class ServiciosService {
  private readonly logger = new Logger(ServiciosService.name);

  constructor(
    @InjectTenantRepository(Servicio)
    private readonly servicioRepo: TenantScopedRepository<Servicio>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly limitesPlan: LimitesPlanService,
  ) {}

  /**
   * Transacción propia (y no `servicioRepo.save`) para que el chequeo del
   * límite del Plan Gratis y el INSERT sean atómicos — ver
   * `LimitesPlanService.asegurarDentroDelLimite()`. Por eso aquí se pone
   * `idNegocio` a mano, igual que ReservasService.crear().
   */
  async crear(dto: CrearServicioDto): Promise<Servicio> {
    const idNegocio = this.tenantContext.idNegocio;
    const servicio = await this.dataSource.transaction(async (manager) => {
      await this.limitesPlan.asegurarDentroDelLimite(manager, 'servicios', idNegocio);
      return manager.save(
        manager.create(Servicio, { ...dto, precio: dto.precio.toFixed(2), idNegocio }),
      );
    });
    this.logger.log(`Servicio ${servicio.idServicio} creado`);
    return servicio;
  }

  async listar(query: PaginationQueryDto): Promise<PaginatedResult<Servicio>> {
    const { page, limit } = query;
    const [servicios, total] = await this.servicioRepo.findAndCount({
      order: { creadoEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: servicios, total, page, limit };
  }

  async obtenerUno(idServicio: string): Promise<Servicio> {
    return this.buscarOFallar(idServicio);
  }

  async actualizar(idServicio: string, dto: ActualizarServicioDto): Promise<Servicio> {
    await this.buscarOFallar(idServicio);
    const { precio, ...resto } = dto;
    await this.servicioRepo.update(
      { idServicio } as any,
      { ...resto, ...(precio !== undefined ? { precio: precio.toFixed(2) } : {}) } as any,
    );
    this.logger.log(`Servicio ${idServicio} actualizado`);
    return this.buscarOFallar(idServicio);
  }

  async desactivar(idServicio: string): Promise<void> {
    await this.buscarOFallar(idServicio);
    await this.servicioRepo.update({ idServicio } as any, { activo: false } as any);
    await this.servicioRepo.softDelete({ idServicio } as any);
    this.logger.log(`Servicio ${idServicio} desactivado`);
  }

  private async buscarOFallar(idServicio: string): Promise<Servicio> {
    const servicio = await this.servicioRepo.findOne({ where: { idServicio } as any });
    if (!servicio) {
      throw new NotFoundException({
        errorCode: 'SERVICIO_NO_ENCONTRADO',
        message: 'Servicio no encontrado',
      });
    }
    return servicio;
  }
}
