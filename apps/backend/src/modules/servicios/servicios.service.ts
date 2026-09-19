import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectTenantRepository, TenantScopedRepository } from '../../common/tenant';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import { Servicio } from '../../database/entities';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';

@Injectable()
export class ServiciosService {
  private readonly logger = new Logger(ServiciosService.name);

  constructor(
    @InjectTenantRepository(Servicio) private readonly servicioRepo: TenantScopedRepository<Servicio>,
  ) {}

  async crear(dto: CrearServicioDto): Promise<Servicio> {
    const servicio = await this.servicioRepo.save(
      this.servicioRepo.create({ ...dto, precio: dto.precio.toFixed(2) }),
    );
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
      throw new NotFoundException({ errorCode: 'SERVICIO_NO_ENCONTRADO', message: 'Servicio no encontrado' });
    }
    return servicio;
  }
}
