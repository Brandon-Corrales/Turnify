import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard es global (APP_GUARD en app.module.ts), así que también
 * intenta correr sobre el transporte WebSocket del Chatbot — pero su
 * implementación asume request/response de Express (`res.header(...)`),
 * que no existe en un ExecutionContext de tipo 'ws' y revienta con
 * "res.header is not a function" (error real, encontrado al verificar el
 * Chatbot de punta a punta con una conexión real).
 *
 * El WebSocket del chatbot ya tiene su propio control de abuso —
 * WsJwtGuard exige autenticación (nada anónimo, a diferencia del resto de
 * endpoints públicos) y LimitePlanGratisGuard limita mensajesChatbot/día
 * — así que basta con que este guard se salte los contextos 'ws' en vez
 * de reimplementar un throttler consciente de sockets.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') return true;
    return super.shouldSkip(context);
  }
}
