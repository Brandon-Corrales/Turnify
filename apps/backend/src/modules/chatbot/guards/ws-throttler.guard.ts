import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { ErrorCodeException } from '../../../common/errors/api-error.interface';

const VENTANA_MS = 10_000;
const MAX_MENSAJES_POR_VENTANA = 5;

/**
 * Rate limit de ráfaga para el WebSocket del chatbot (punto 15 del
 * brief). `AppThrottlerGuard` (el throttler global de la app) salta por
 * completo cualquier contexto 'ws' porque `ThrottlerGuard` de
 * `@nestjs/throttler` asume request/response de Express y revienta con
 * "res.header is not a function" sobre un socket — ver el comentario
 * largo en `common/throttler/ws-aware-throttler.guard.ts`. Eso dejaba el
 * chatbot con un solo control de abuso real: el tope DIARIO de
 * `mensajesChatbot` (`LimitePlanGratisGuard`), que no evita que alguien
 * mande esos mismos mensajes en una ráfaga de segundos — agotando el
 * cupo del día de un golpe o saturando la API de Groq sin necesidad.
 *
 * Ventana fija en memoria por socket (mismo criterio que
 * `ChatbotGateway.historiales`: estado por conexión, se pierde al
 * desconectar, a propósito) — más simple y explícito que forzar
 * `@nestjs/throttler` a entender WebSockets, y consistente con el resto
 * de guards transversales del proyecto (estado propio en vez de pelear
 * con una librería pensada para HTTP).
 */
@Injectable()
export class ChatbotWsThrottlerGuard implements CanActivate {
  private readonly conteos = new Map<string, { inicio: number; cantidad: number }>();

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const ahora = Date.now();
    const registro = this.conteos.get(client.id);

    if (!registro || ahora - registro.inicio >= VENTANA_MS) {
      this.conteos.set(client.id, { inicio: ahora, cantidad: 1 });
      return true;
    }

    if (registro.cantidad >= MAX_MENSAJES_POR_VENTANA) {
      throw new ErrorCodeException(
        'DEMASIADAS_SOLICITUDES',
        'Estás enviando mensajes muy rápido. Espera unos segundos e intenta de nuevo.',
        429,
      );
    }

    registro.cantidad += 1;
    return true;
  }

  /** Llamado desde `ChatbotGateway.handleDisconnect` — evita que el mapa crezca sin límite con sockets ya cerrados. */
  limpiar(idSocket: string): void {
    this.conteos.delete(idSocket);
  }
}
