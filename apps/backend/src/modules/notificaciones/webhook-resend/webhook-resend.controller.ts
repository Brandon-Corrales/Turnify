import { Controller, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ErrorCodeException } from '../../../common/errors/api-error.interface';
import { Public } from '../../auth/decorators/public.decorator';
import {
  FirmaWebhookInvalidaError,
  WebhookNoConfiguradoError,
  WebhookResendService,
} from './webhook-resend.service';

const firmaInvalida = () =>
  new ErrorCodeException(
    'WEBHOOK_FIRMA_INVALIDA',
    'Firma del webhook inválida o vencida',
    HttpStatus.BAD_REQUEST,
  );

/**
 * Resend llama este endpoint directo, sin JWT de nadie: @Public() y sin
 * contexto de tenant (la notificación se encuentra por el id del correo).
 * La firma Svix es la única autenticación de la ruta, y se verifica sobre
 * el body CRUDO (`rawBody: true` en main.ts): "the cryptographic signature
 * is sensitive to even the slightest change" (docs de Resend).
 *
 * Respuestas: 200 si se procesó, se ignoró o ya se había procesado (Resend
 * no debe reintentar); 400 con firma inválida o vencida; 503 si falta
 * RESEND_WEBHOOK_SECRET (Resend reintenta más tarde).
 */
@ApiTags('webhooks')
@Controller('webhooks/resend')
export class WebhookResendController {
  constructor(private readonly webhookResend: WebhookResendService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post()
  @ApiOperation({
    summary: 'Webhook de Resend (llamado por Resend, no por el frontend) — idempotente',
    description:
      'Verifica la firma Svix (svix-id, svix-timestamp, svix-signature) sobre el body crudo; no requiere JWT.',
  })
  async recibir(@Req() req: RawBodyRequest<Request>) {
    const id = req.headers['svix-id'];
    const timestamp = req.headers['svix-timestamp'];
    const signature = req.headers['svix-signature'];
    if (
      !req.rawBody ||
      typeof id !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof signature !== 'string'
    ) {
      throw firmaInvalida();
    }

    let evento;
    try {
      evento = this.webhookResend.verificar(req.rawBody.toString('utf8'), {
        id,
        timestamp,
        signature,
      });
    } catch (error) {
      if (error instanceof WebhookNoConfiguradoError) {
        throw new ErrorCodeException(
          'WEBHOOK_NO_CONFIGURADO',
          'El webhook no está configurado en este servidor',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (error instanceof FirmaWebhookInvalidaError) throw firmaInvalida();
      throw error;
    }

    const resultado = await this.webhookResend.procesar(id, evento);
    return { recibido: true, resultado };
  }
}
