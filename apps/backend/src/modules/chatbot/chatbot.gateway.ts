import { Logger, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { LimitePlan } from '../suscripciones/decorators/limite-plan.decorator';
import { LimitePlanGratisGuard } from '../suscripciones/guards/limite-plan-gratis.guard';
import { ChatbotService } from './chatbot.service';
import { MensajeChatbotDto } from './dto/mensaje-chatbot.dto';
import { WsExceptionsFilter } from './filters/ws-exceptions.filter';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import type { MensajeLlm } from './providers/llm-client.interface';

/** Tope de turnos guardados por conexión: evita que una conversación larga crezca sin límite en memoria (no persiste entre reconexiones, ver ChatbotService.PreguntaChatbot). */
const MAX_TURNOS_HISTORIAL = 20;

/**
 * Gateway del asistente contextual (punto 16 del brief). Namespace propio
 * (`/chatbot`) para no interferir con otros WebSockets que pueda tener la
 * app más adelante. CORS leído de la misma variable que usa el HTTP normal
 * (`main.ts`) — @WebSocketGateway evalúa sus opciones antes de que exista
 * inyección de dependencias, así que se lee `process.env` directo aquí,
 * no vía ConfigService.
 */
@WebSocketGateway({
  namespace: 'chatbot',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true },
})
export class ChatbotGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(ChatbotGateway.name);
  /** Historial de conversación en memoria por socket — se pierde al desconectar, a propósito. */
  private readonly historiales = new Map<string, MensajeLlm[]>();

  constructor(private readonly chatbotService: ChatbotService) {}

  handleDisconnect(client: Socket): void {
    this.historiales.delete(client.id);
  }

  @UseFilters(WsExceptionsFilter)
  @UseGuards(WsJwtGuard, LimitePlanGratisGuard)
  @LimitePlan('mensajesChatbot')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('mensaje')
  async manejarMensaje(
    @ConnectedSocket() client: Socket,
    @MessageBody() datos: MensajeChatbotDto,
  ): Promise<void> {
    const usuario = client.data.user as JwtPayload;
    const historial = this.historiales.get(client.id) ?? [];

    let respuesta = '';
    for await (const fragmento of this.chatbotService.responder({
      idNegocio: usuario.idNegocio,
      idUsuario: usuario.sub,
      rol: usuario.rol,
      pantallaActual: datos.pantallaActual,
      pregunta: datos.pregunta,
      historialPrevio: historial,
    })) {
      respuesta += fragmento;
      client.emit('respuesta-chunk', fragmento);
    }

    historial.push({ rol: 'user', texto: datos.pregunta }, { rol: 'model', texto: respuesta });
    this.historiales.set(client.id, historial.slice(-MAX_TURNOS_HISTORIAL));
    client.emit('respuesta-fin');
  }
}
