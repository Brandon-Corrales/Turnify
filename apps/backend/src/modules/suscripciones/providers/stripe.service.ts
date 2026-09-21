import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../../../config/env.schema';

export interface DatosCheckout {
  idNegocio: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Envoltorio inyectable sobre el SDK de Stripe (mismo patrón que
 * ResendService/WhatsappCloudApiService: mockeable en tests, nunca
 * llamado directo desde SuscripcionesService).
 *
 * **Limitación real, no técnica**: Costa Rica no está entre los países
 * donde Stripe permite abrir cuenta, ni siquiera en modo de pruebas —
 * confirmado por el equipo, no es un error de la interfaz. Este servicio
 * está completo e implementado correctamente contra la API oficial, pero
 * nunca se pudo probar contra la API real de Stripe; la cobertura real es
 * únicamente vía tests unitarios con el SDK mockeado. Ver PROGRESS.md.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly cliente: Stripe | null;
  private readonly precioIdPlanPago?: string;
  private readonly webhookSecret?: string;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.cliente = secretKey ? new Stripe(secretKey) : null;
    this.precioIdPlanPago = config.get('STRIPE_PRICE_ID_PLAN_PAGO', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
  }

  async crearCheckoutSession(datos: DatosCheckout): Promise<string> {
    if (!this.cliente || !this.precioIdPlanPago) {
      // 503, no 500: es una integración externa sin configurar (o, en
      // este proyecto, permanentemente no disponible por la restricción
      // geográfica de Stripe — ver PROGRESS.md), no un bug del backend.
      throw new ServiceUnavailableException({
        errorCode: 'PASARELA_PAGOS_NO_DISPONIBLE',
        message: 'La pasarela de pagos no está disponible en este momento',
      });
    }
    const session = await this.cliente.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.precioIdPlanPago, quantity: 1 }],
      success_url: datos.successUrl,
      cancel_url: datos.cancelUrl,
      client_reference_id: datos.idNegocio,
      metadata: { idNegocio: datos.idNegocio },
    });
    if (!session.url) {
      throw new Error('Stripe no devolvió una URL de checkout');
    }
    return session.url;
  }

  /** Verifica la firma HMAC del webhook — lanza si el payload no viene realmente de Stripe. */
  construirEvento(payloadCrudo: Buffer, firma: string): Stripe.Event {
    if (!this.cliente || !this.webhookSecret) {
      throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)');
    }
    return this.cliente.webhooks.constructEvent(payloadCrudo, firma, this.webhookSecret);
  }
}
