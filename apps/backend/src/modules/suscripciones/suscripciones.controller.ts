import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SuscripcionesService } from './suscripciones.service';
import { StripeService } from './providers/stripe.service';
import { IniciarCheckoutDto } from './dto/iniciar-checkout.dto';

@ApiTags('suscripciones')
@Controller('suscripciones')
export class SuscripcionesController {
  constructor(
    private readonly suscripcionesService: SuscripcionesService,
    private readonly stripe: StripeService,
  ) {}

  @ApiBearerAuth()
  @Get('mi-suscripcion')
  obtenerMiSuscripcion() {
    return this.suscripcionesService.obtenerActual();
  }

  @ApiBearerAuth()
  @Post('checkout')
  iniciarCheckout(@Body() dto: IniciarCheckoutDto) {
    return this.suscripcionesService.iniciarUpgrade(dto.successUrl, dto.cancelUrl);
  }

  /**
   * Stripe llama este endpoint directo, sin el JWT de ningún usuario de
   * Turnify — @Public() y sin guard multi-tenant (el idNegocio sale del
   * propio evento, ver SuscripcionesService.manejarEvento). La firma
   * HMAC del header Stripe-Signature es la única autenticación real de
   * esta ruta.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  async recibirWebhook(@Req() req: RawBodyRequest<Request>) {
    const firma = req.headers['stripe-signature'];
    if (!req.rawBody || typeof firma !== 'string') {
      throw new BadRequestException('Falta el body crudo o el header Stripe-Signature');
    }
    let evento;
    try {
      evento = this.stripe.construirEvento(req.rawBody, firma);
    } catch {
      throw new BadRequestException('Firma de Stripe inválida');
    }
    await this.suscripcionesService.manejarEvento(evento);
    return { recibido: true };
  }
}
