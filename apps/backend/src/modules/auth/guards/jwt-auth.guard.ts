import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Env } from '../../../config/env.schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest, JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Global (APP_GUARD), pero solo entiende HTTP: el transporte WebSocket
    // del Chatbot tiene su propia autenticación (WsJwtGuard, aplicado
    // explícito en el gateway) porque un handshake de socket.io no trae
    // el header Authorization de una request HTTP normal. Sin este salto,
    // `request.headers.authorization` revienta con el socket que devuelve
    // switchToHttp().getRequest() en un contexto 'ws' (error real,
    // encontrado al verificar el chatbot de punta a punta).
    if (context.getType() === 'ws') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        errorCode: 'TOKEN_FALTANTE',
        message: 'Falta el token de acceso',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      request.user = { sub: payload.sub, idNegocio: payload.idNegocio, rol: payload.rol };
      return true;
    } catch {
      throw new UnauthorizedException({
        errorCode: 'TOKEN_INVALIDO',
        message: 'Token de acceso inválido o expirado',
      });
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
