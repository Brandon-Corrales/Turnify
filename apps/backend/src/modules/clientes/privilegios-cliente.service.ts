import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Cliente, Negocio, NivelCliente, PlanSuscripcion } from '../../database/entities';

/**
 * Punto 5.2 del brief: el nivel Premium del CLIENTE desbloquea un canal
 * de notificación adicional (WhatsApp) — pero SIEMPRE limitado por el
 * techo del plan del propio NEGOCIO (punto 5.1: Plan Gratis bloquea
 * WhatsApp por completo). "Un cliente Premium de un negocio en Plan
 * Gratis igual no recibe WhatsApp" es el ejemplo textual del brief — las
 * dos condiciones de abajo son exactamente eso, en ese orden.
 *
 * Separado de PrivilegioClienteGuard (igual que LimitesPlanService de
 * LimitePlanGratisGuard): las consultas a Repository viven aquí, no en
 * el guard, así el guard queda mockeable/testeable sin tocar TypeORM.
 */
@Injectable()
export class PrivilegiosClienteService {
  constructor(
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Negocio) private readonly negocioRepo: Repository<Negocio>,
    private readonly i18n: I18nService,
  ) {}

  /** Lanza ForbiddenException si el negocio/cliente no puede usar WhatsApp como canal preferido. */
  async verificarCanalWhatsapp(
    idNegocio: string,
    idClienteExistente: string | undefined,
    nivelClienteEnBody: NivelCliente | undefined,
  ): Promise<void> {
    const nivelEfectivo = await this.resolverNivelEfectivo(idClienteExistente, nivelClienteEnBody);
    if (nivelEfectivo !== NivelCliente.PREMIUM) {
      this.rechazar(
        'PRIVILEGIO_CLIENTE_NIVEL',
        'El canal WhatsApp para recordatorios está disponible solo para clientes de nivel Premium',
      );
    }

    const negocio = await this.negocioRepo.findOne({ where: { idNegocio } });
    if (!negocio || negocio.planSuscripcion === PlanSuscripcion.GRATIS) {
      this.rechazar(
        'PRIVILEGIO_CLIENTE_PLAN_NEGOCIO',
        'El plan actual del negocio no tiene el canal WhatsApp habilitado',
      );
    }
  }

  private async resolverNivelEfectivo(
    idClienteExistente: string | undefined,
    nivelClienteEnBody: NivelCliente | undefined,
  ): Promise<NivelCliente> {
    if (nivelClienteEnBody) return nivelClienteEnBody;
    if (!idClienteExistente) return NivelCliente.GRATIS; // default de un cliente nuevo sin nivelCliente en el body
    const actual = await this.clienteRepo.findOne({ where: { idCliente: idClienteExistente } });
    return actual?.nivelCliente ?? NivelCliente.GRATIS;
  }

  private rechazar(clave: string, mensajePorDefecto: string): never {
    throw new ForbiddenException({
      errorCode: 'PRIVILEGIO_CLIENTE_NO_DISPONIBLE',
      message: this.i18n.translate(`errores.${clave}`, {
        lang: I18nContext.current()?.lang,
        defaultValue: mensajePorDefecto,
      }),
    });
  }
}
