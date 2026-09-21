import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/jwt-payload.interface';
import { TenantContextService } from './tenant-context.service';

/**
 * Puebla el TenantContextService para toda la duración de la request.
 * Corre como interceptor (no como guard) porque necesita envolver la
 * ejecución del handler completo (`next.handle()`) dentro de
 * `AsyncLocalStorage.run()` — un guard solo decide sí/no antes del
 * handler, no puede mantener un contexto async alrededor de él.
 *
 * Debe ejecutarse DESPUÉS de JwtAuthGuard (que es quien pone
 * `request.user`) — los interceptores globales corren después de los
 * guards globales en el ciclo de vida de Nest, así que el orden ya es
 * correcto sin configuración adicional.
 *
 * En rutas @Public() no hay `request.user`: no se abre contexto de
 * tenant y las queries de esa ruta deben usar repositorios normales
 * (nunca TenantScopedRepository, que exige contexto y lanza si no existe).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      return next.handle();
    }

    const { sub: idUsuario, idNegocio, rol } = request.user;
    return new Observable((subscriber) => {
      this.tenantContext.run({ idUsuario, idNegocio, rol }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
