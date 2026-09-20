import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { EstadoSuscripcion, Negocio, PlanSuscripcion, Suscripcion } from '../../database/entities';
import { TenantContextService } from '../../common/tenant';
import { StripeService } from './providers/stripe.service';

/**
 * Plan pago único para el MVP (punto 5.1 del brief: "si no, un solo nivel
 * de pago es suficiente"). El ER ya deja BASICO/PREMIUM/EMPRESARIAL
 * escalonados para cuando el equipo decida ofrecer más de un nivel — solo
 * haría falta otro STRIPE_PRICE_ID y otro botón de checkout, sin tocar
 * este servicio.
 */
const PLAN_PAGO = PlanSuscripcion.BASICO;

@Injectable()
export class SuscripcionesService {
  private readonly logger = new Logger(SuscripcionesService.name);

  constructor(
    @InjectRepository(Suscripcion) private readonly suscripcionRepo: Repository<Suscripcion>,
    @InjectRepository(Negocio) private readonly negocioRepo: Repository<Negocio>,
    private readonly tenantContext: TenantContextService,
    private readonly stripe: StripeService,
  ) {}

  async obtenerActual(): Promise<Suscripcion> {
    const idNegocio = this.tenantContext.idNegocio;
    const suscripcion = await this.suscripcionRepo.findOne({
      where: { idNegocio },
      order: { fechaInicio: 'DESC' },
    });
    if (!suscripcion) {
      throw new NotFoundException({
        errorCode: 'SUSCRIPCION_NO_ENCONTRADA',
        message: 'Este negocio no tiene una suscripción registrada',
      });
    }
    return suscripcion;
  }

  async iniciarUpgrade(successUrl: string, cancelUrl: string): Promise<{ url: string }> {
    const idNegocio = this.tenantContext.idNegocio;
    const url = await this.stripe.crearCheckoutSession({ idNegocio, successUrl, cancelUrl });
    return { url };
  }

  /**
   * El webhook de Stripe no corre dentro de una request autenticada del
   * negocio (Stripe lo llama directo) — por eso NO usa
   * TenantContextService ni TenantScopedRepository, y el idNegocio sale
   * siempre de `metadata`/`client_reference_id` del propio evento, nunca
   * de un contexto ambiental que aquí no existe.
   */
  async manejarEvento(evento: Stripe.Event): Promise<void> {
    switch (evento.type) {
      case 'checkout.session.completed':
        await this.manejarCheckoutCompletado(evento.data.object as Stripe.Checkout.Session);
        return;
      case 'customer.subscription.deleted':
        await this.manejarSuscripcionCancelada(evento.data.object as Stripe.Subscription);
        return;
      case 'customer.subscription.updated':
        await this.manejarSuscripcionActualizada(evento.data.object as Stripe.Subscription);
        return;
      default:
        this.logger.log(`Evento de Stripe sin manejador específico: ${evento.type}`);
    }
  }

  private async manejarCheckoutCompletado(session: Stripe.Checkout.Session): Promise<void> {
    const idNegocio = session.metadata?.idNegocio ?? session.client_reference_id;
    if (!idNegocio) {
      this.logger.warn(
        `checkout.session.completed sin idNegocio en metadata (session ${session.id})`,
      );
      return;
    }
    const idSuscripcionStripe =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    // Idempotencia: si ya existe una fila de esta MISMA sesión/suscripción
    // de Stripe, el evento ya se procesó (Stripe puede reenviar el mismo
    // evento más de una vez) — no se duplica ni se vuelve a aplicar.
    const yaProcesado = await this.suscripcionRepo.findOne({
      where: { idPagoPasarela: idSuscripcionStripe ?? session.id },
    });
    if (yaProcesado) {
      this.logger.log(`checkout.session.completed ya procesado antes (session ${session.id})`);
      return;
    }

    await this.suscripcionRepo.save(
      this.suscripcionRepo.create({
        idNegocio,
        plan: PLAN_PAGO,
        fechaInicio: new Date(),
        montoMensual: ((session.amount_total ?? 0) / 100).toFixed(2),
        estado: EstadoSuscripcion.ACTIVA,
        idPagoPasarela: idSuscripcionStripe ?? session.id,
      }),
    );
    await this.negocioRepo.update({ idNegocio }, { planSuscripcion: PLAN_PAGO });
    this.logger.log(`Negocio ${idNegocio} pasó a plan de pago (Stripe session ${session.id})`);
  }

  private async manejarSuscripcionCancelada(
    subscripcionStripe: Stripe.Subscription,
  ): Promise<void> {
    const suscripcion = await this.suscripcionRepo.findOne({
      where: { idPagoPasarela: subscripcionStripe.id },
    });
    if (!suscripcion) return;

    await this.suscripcionRepo.update(
      { idSuscripcion: suscripcion.idSuscripcion },
      { estado: EstadoSuscripcion.CANCELADA, fechaFin: new Date() },
    );
    await this.negocioRepo.update(
      { idNegocio: suscripcion.idNegocio },
      { planSuscripcion: PlanSuscripcion.GRATIS },
    );
    this.logger.log(
      `Negocio ${suscripcion.idNegocio} volvió a plan gratis (suscripción cancelada)`,
    );
  }

  private async manejarSuscripcionActualizada(
    subscripcionStripe: Stripe.Subscription,
  ): Promise<void> {
    const suscripcion = await this.suscripcionRepo.findOne({
      where: { idPagoPasarela: subscripcionStripe.id },
    });
    if (!suscripcion) return;

    // past_due/unpaid: el negocio no pagó a tiempo — se suspende sin
    // perder el historial (distinto de canceled, que sí es definitivo).
    const activa = subscripcionStripe.status === 'active';
    await this.suscripcionRepo.update(
      { idSuscripcion: suscripcion.idSuscripcion },
      { estado: activa ? EstadoSuscripcion.ACTIVA : EstadoSuscripcion.SUSPENDIDA },
    );
    await this.negocioRepo.update(
      { idNegocio: suscripcion.idNegocio },
      { planSuscripcion: activa ? PLAN_PAGO : PlanSuscripcion.GRATIS },
    );
  }
}
