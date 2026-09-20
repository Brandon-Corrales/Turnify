import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';
import { LimitesPlanService } from '../limites-plan.service';
import { LIMITE_PLAN_KEY, RecursoLimitado } from '../decorators/limite-plan.decorator';

const MENSAJE_POR_RECURSO: Record<RecursoLimitado, string> = {
  usuarios:
    'El Plan Gratis permite solo 1 usuario (el admin). Actualiza a un plan de pago para invitar empleados.',
  servicios:
    'El Plan Gratis permite hasta 3 servicios activos. Actualiza a un plan de pago para agregar más.',
  reservas:
    'El Plan Gratis permite hasta 20 reservas por mes. Actualiza a un plan de pago para seguir reservando.',
};

/**
 * Guard transversal (mismo patrón que el guard multi-tenant del punto 1):
 * se aplica una sola vez por endpoint vía @LimitePlan(...), nunca copiado
 * y repetido dentro de cada servicio.
 *
 * **El idNegocio sale de `request.user` (lo pone JwtAuthGuard), NO de
 * TenantContextService** — los Guards de Nest corren TODOS antes que
 * los Interceptors (orden real del framework: Guards → Interceptors →
 * Pipes → Handler), y es el `TenantContextInterceptor` quien llena el
 * AsyncLocalStorage que usa TenantContextService. Si este guard
 * dependiera de TenantContextService, `idNegocio` todavía no existiría
 * en el momento en que corre — error real encontrado en las pruebas de
 * esta tarjeta ("no hay contexto de negocio activo"), no una suposición.
 *
 * **Solo depende de Reflector y LimitesPlanService (exportado por
 * SuscripcionesModule) — nunca directo de un Repository.** Un guard
 * aplicado vía @UseGuards(Clase) se instancia con el inyector del MÓDULO
 * CONSUMIDOR (UsuariosModule, ServiciosModule, ReservasModule), no con
 * el de SuscripcionesModule donde vive — si dependiera de un Repository
 * de TypeORM directamente, fallaría en cualquier módulo que no tenga ese
 * TypeOrmModule.forFeature(...) propio (otro gotcha real de NestJS,
 * también encontrado durante las pruebas de esta tarjeta).
 */
@Injectable()
export class LimitePlanGratisGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limitesPlan: LimitesPlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const recurso = this.reflector.get<RecursoLimitado | undefined>(
      LIMITE_PLAN_KEY,
      context.getHandler(),
    );
    if (!recurso) return true;

    const idNegocio = context.switchToHttp().getRequest<AuthenticatedRequest>().user.idNegocio;
    if (!(await this.limitesPlan.estaEnPlanGratis(idNegocio))) return true;

    const conteo = await this.limitesPlan.contar(recurso, idNegocio);
    if (conteo >= this.limitesPlan.limite(recurso)) {
      throw new ForbiddenException({
        errorCode: 'LIMITE_PLAN_ALCANZADO',
        message: MENSAJE_POR_RECURSO[recurso],
      });
    }
    return true;
  }
}
