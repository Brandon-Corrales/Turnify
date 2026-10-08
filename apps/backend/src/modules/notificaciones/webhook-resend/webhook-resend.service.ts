import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Resend } from 'resend';
import { DataSource } from 'typeorm';
import type { Env } from '../../../config/env.schema';
import { Notificacion } from '../../../database/entities';
import { type EventoCorreoResend, transicionPorEvento } from './transicion-por-evento';

/** Headers de Svix con los que Resend firma cada webhook. */
export interface HeadersSvix {
  id: string;
  timestamp: string;
  signature: string;
}

export type ResultadoWebhook = 'procesado' | 'duplicado' | 'ignorado';

export class WebhookNoConfiguradoError extends Error {}
export class FirmaWebhookInvalidaError extends Error {}

/**
 * Webhook de Resend (entregas, demoras, rebotes, quejas y fallos).
 *
 * Firma: `resend.webhooks.verify()` del SDK oficial, que delega en la clase
 * `Webhook` de `standardwebhooks` (HMAC-SHA256 sobre
 * `${svix-id}.${svix-timestamp}.${body crudo}`, comparación en tiempo
 * constante, y rechaza timestamps a más de 5 minutos del reloj del
 * servidor, en ambas direcciones). Ver
 * https://resend.com/docs/webhooks/verify-webhooks-requests
 *
 * Idempotencia: el `svix-id` es el mismo cuando Resend reenvía un mensaje
 * (https://docs.svix.com/receiving/verifying-payloads/how-manual), así que
 * se registra en `webhook_eventos_procesados` en la MISMA transacción que
 * el cambio de la notificación: si algo falla, no queda marcado y el
 * reintento de Resend lo vuelve a aplicar; si ya estaba, no se aplica dos
 * veces.
 */
@Injectable()
export class WebhookResendService {
  private readonly logger = new Logger(WebhookResendService.name);
  private readonly secreto: string | undefined;
  private readonly resend: Resend;

  constructor(
    config: ConfigService<Env, true>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.secreto = config.get('RESEND_WEBHOOK_SECRET', { infer: true });
    // verify() es un cálculo local (HMAC): nunca llama a la API de Resend,
    // así que funciona aunque no haya RESEND_API_KEY. El constructor del
    // SDK sí exige una key no vacía, de ahí el valor de relleno.
    this.resend = new Resend(config.get('RESEND_API_KEY', { infer: true }) || 'solo-verificacion');
  }

  verificar(cuerpoCrudo: string, headers: HeadersSvix): EventoCorreoResend {
    if (!this.secreto) throw new WebhookNoConfiguradoError();
    try {
      return this.resend.webhooks.verify({
        payload: cuerpoCrudo,
        headers,
        webhookSecret: this.secreto,
      }) as unknown as EventoCorreoResend;
    } catch (error) {
      this.logger.warn(`Webhook de Resend rechazado: ${(error as Error).message}`);
      throw new FirmaWebhookInvalidaError();
    }
  }

  async procesar(idMensaje: string, evento: EventoCorreoResend): Promise<ResultadoWebhook> {
    return this.dataSource.transaction(async (manager) => {
      const insertadas: unknown[] = await manager.query(
        `INSERT INTO "webhook_eventos_procesados" ("id_mensaje", "proveedor", "tipo_evento")
         VALUES ($1, 'resend', $2) ON CONFLICT ("id_mensaje") DO NOTHING RETURNING "id_mensaje"`,
        [idMensaje, String(evento.type).slice(0, 64)],
      );
      if (insertadas.length === 0) {
        this.logger.log(`Webhook de Resend ${idMensaje} repetido: ya se había procesado`);
        return 'duplicado';
      }

      const idCorreo = evento.data?.email_id;
      if (!idCorreo) return 'ignorado';
      const notificacion = await manager.findOne(Notificacion, {
        where: { idCorreoProveedor: idCorreo },
        lock: { mode: 'pessimistic_write' },
      });
      if (!notificacion) {
        // Correos que no salieron de una notificación (o de otro entorno
        // que comparte la cuenta de Resend): se registran y se ignoran.
        this.logger.log(`Webhook de Resend ${evento.type} sin notificación asociada`);
        return 'ignorado';
      }

      const transicion = transicionPorEvento(evento, notificacion);
      if (!transicion) return 'ignorado';
      await manager.update(
        Notificacion,
        { idNotificacion: notificacion.idNotificacion },
        transicion,
      );
      // Solo el tipo del rebote: `bounce.message` puede traer la dirección
      // del destinatario y no va ni al log.
      const detalle = evento.data.bounce ? ` (${evento.data.bounce.type ?? '?'})` : '';
      this.logger.log(
        `Notificación ${notificacion.idNotificacion}: ${evento.type}${detalle} → ${transicion.estado}`,
      );
      return 'procesado';
    });
  }
}
