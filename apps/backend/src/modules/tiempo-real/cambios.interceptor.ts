import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TiempoRealGateway } from './tiempo-real.gateway';

const METODOS_DE_ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rutas que escriben pero no cambian nada visible en el panel: sesión
 * (login/refresh/logout) y el inicio del checkout de Stripe (el cambio
 * real de plan llega después por webhook).
 */
const RECURSOS_IGNORADOS = new Set(['auth', 'suscripciones']);

/**
 * Global: después de CUALQUIER escritura HTTP que termine bien, avisa por
 * WebSocket a todas las pantallas abiertas de ese negocio (ver
 * TiempoRealGateway). Hacerlo aquí en vez de en cada service garantiza que
 * un endpoint nuevo quede sincronizado sin acordarse de emitir nada.
 *
 * El negocio sale del JWT (rutas autenticadas) o de `:idNegocio` en la URL
 * (reserva pública, donde el visitante no tiene sesión). Si la request
 * falla (`tap` solo corre en éxito) no se avisa nada.
 */
@Injectable()
export class CambiosInterceptor implements NestInterceptor {
  constructor(private readonly gateway: TiempoRealGateway) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!METODOS_DE_ESCRITURA.has(request.method)) return next.handle();

    const recurso = CambiosInterceptor.recursoDe(request.path);
    if (RECURSOS_IGNORADOS.has(recurso)) return next.handle();

    const idNegocio = request.user?.idNegocio ?? (request.params?.idNegocio as string | undefined);
    if (!idNegocio) return next.handle();

    return next.handle().pipe(
      tap(() => this.gateway.notificarCambio(idNegocio, { recurso })),
    );
  }

  /** '/reservas/abc/cancelar' → 'reservas'; '/publico/negocios/x/reservas' → 'reservas'. */
  static recursoDe(ruta: string): string {
    const segmentos = ruta.split('/').filter(Boolean);
    if (segmentos[0] === 'publico') return segmentos[3] ?? 'reservas';
    return segmentos[0] ?? '';
  }
}
