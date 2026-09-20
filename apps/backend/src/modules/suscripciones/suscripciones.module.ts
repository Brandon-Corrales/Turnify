import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MensajeChatbot,
  Negocio,
  Reserva,
  Servicio,
  Suscripcion,
  Usuario,
} from '../../database/entities';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesService } from './suscripciones.service';
import { LimitesPlanService } from './limites-plan.service';
import { StripeService } from './providers/stripe.service';
import { LimitePlanGratisGuard } from './guards/limite-plan-gratis.guard';

/**
 * Repositories planos (no TenantScopedRepository): el webhook de Stripe
 * corre sin contexto de tenant (ver SuscripcionesService.manejarEvento),
 * y LimitesPlanService necesita contar Usuario/Servicio/Reserva de un
 * idNegocio explícito, no del contexto ambiental de OTRO módulo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Suscripcion, Negocio, Usuario, Servicio, Reserva, MensajeChatbot]),
  ],
  controllers: [SuscripcionesController],
  providers: [SuscripcionesService, LimitesPlanService, StripeService, LimitePlanGratisGuard],
  // LimitesPlanService se exporta (no los Repository que envuelve) para
  // que LimitePlanGratisGuard funcione al instanciarse en el módulo
  // consumidor — ver el comentario del propio guard.
  exports: [SuscripcionesService, LimitePlanGratisGuard, LimitesPlanService],
})
export class SuscripcionesModule {}
