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
 * El WebSocket del chatbot tiene su propio control de abuso aparte de
 * este guard global: WsJwtGuard exige autenticación (nada anónimo, a
 * diferencia del resto de endpoints públicos), LimitePlanGratisGuard
 * limita mensajesChatbot/día, y ChatbotWsThrottlerGuard (módulo del
 * chatbot) limita ráfagas por segundo — los tres viven en
 * `modules/chatbot/guards`, aplicados directo en `ChatbotGateway`, en
 * vez de forzar a este guard genérico a entender sockets.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') return true;
    return super.shouldSkip(context);
  }
}
