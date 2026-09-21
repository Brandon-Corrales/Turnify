import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { Env } from '../../../config/env.schema';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Equivalente de JwtAuthGuard pero para el transporte WebSocket — el
 * chatbot "se trata como un endpoint autenticado más" (punto 16 del
 * brief), pero un socket.io handshake no tiene el header Authorization
 * de una request HTTP normal, así que necesita su propia extracción de
 * token (desde `handshake.auth.token`, lo que manda el cliente al
 * conectar) en vez de reusar JwtAuthGuard tal cual.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    if (client.data.user) return true; // ya autenticado en handleConnection

    const token = client.handshake.auth?.token as string | undefined;
    if (!token) throw new WsException('Falta el token de acceso');

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Token de acceso inválido o expirado');
    }
  }
}
