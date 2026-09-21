import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant';
import { Negocio } from '../../database/entities';
import { ActualizarNegocioDto } from './dto/actualizar-negocio.dto';

/**
 * Negocio es la raíz del tenant (su PK ES el id de tenant), no una entidad
 * hija con FK idNegocio — por eso este servicio no usa
 * TenantScopedRepository (pensado para entidades hijas) y en su lugar
 * filtra explícitamente por `idNegocio: tenantContext.idNegocio` en cada
 * operación, la única excepción documentada al wrapper genérico.
 */
@Injectable()
export class NegociosService {
  private readonly logger = new Logger(NegociosService.name);

  constructor(
    @InjectRepository(Negocio) private readonly negocioRepo: Repository<Negocio>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async obtenerMiNegocio(): Promise<Negocio> {
    return this.buscarOFallar();
  }

  async actualizarMiNegocio(dto: ActualizarNegocioDto): Promise<Negocio> {
    const idNegocio = this.tenantContext.idNegocio;
    await this.buscarOFallar();
    await this.negocioRepo.update({ idNegocio }, dto);
    this.logger.log(`Negocio ${idNegocio} actualizó su perfil`);
    return this.buscarOFallar();
  }

  async desactivarMiNegocio(): Promise<void> {
    const idNegocio = this.tenantContext.idNegocio;
    await this.buscarOFallar();
    await this.negocioRepo.update({ idNegocio }, { estado: 'inactivo' });
    await this.negocioRepo.softDelete({ idNegocio });
    this.logger.log(`Negocio ${idNegocio} fue desactivado`);
  }

  private async buscarOFallar(): Promise<Negocio> {
    const idNegocio = this.tenantContext.idNegocio;
    const negocio = await this.negocioRepo.findOne({ where: { idNegocio } });
    if (!negocio) {
      throw new NotFoundException({
        errorCode: 'NEGOCIO_NO_ENCONTRADO',
        message: 'El negocio de la sesión actual ya no existe',
      });
    }
    return negocio;
  }
}
