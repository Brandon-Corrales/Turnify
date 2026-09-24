import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { Env } from '../../config/env.schema';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/** Payload del evento 'datos-cambiados' que recibe el frontend. */
export interface CambioDatos {
  /** Primer segmento de la ruta que produjo el cambio (ej. 'reservas', 'clientes'). */
  recurso: string;
}

/**
 * Canal de sincronización en tiempo real: cada pantalla del panel abre un
 * socket a `/eventos` y queda en la sala de SU negocio. Cuando cualquier
 * escritura (del propio admin, de otro empleado o de un cliente desde el
 * link público) termina bien, CambiosInterceptor emite 'datos-cambiados'
 * a esa sala y el frontend vuelve a pedir los datos visibles — sin
 * refrescar la página. Solo avisa QUÉ cambió, nunca manda los datos: el
 * frontend los relee por HTTP con sus guards/tenant de siempre.
 *
 * Namespace propio para no mezclarse con `/chatbot`. La autenticación se
 * hace al conectar (no por mensaje, como en el chatbot) porque este
 * socket nunca recibe mensajes del cliente, solo emite.
 */
@WebSocketGateway({
  namespace: 'eventos',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true },
})
export class TiempoRealGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TiempoRealGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      client.data.user = payload;
      await client.join(TiempoRealGateway.sala(payload.idNegocio));
    } catch {
      client.disconnect(true);
    }
  }

  notificarCambio(idNegocio: string, cambio: CambioDatos): void {
    // `server` no existe hasta que el adaptador WS inicializa el gateway —
    // en tests unitarios HTTP puede no estar; no hay nadie a quien avisar.
    if (!this.server) return;
    this.server.to(TiempoRealGateway.sala(idNegocio)).emit('datos-cambiados', cambio);
    this.logger.debug(`Cambio '${cambio.recurso}' notificado al negocio ${idNegocio}`);
  }

  private static sala(idNegocio: string): string {
    return `negocio:${idNegocio}`;
  }
}
