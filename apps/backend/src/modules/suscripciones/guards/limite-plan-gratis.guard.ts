import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nContext } from 'nestjs-i18n';
import type { Socket } from 'socket.io';
import type { AuthenticatedRequest, JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { LimitesPlanService } from '../limites-plan.service';
import { LIMITE_PLAN_KEY, RecursoLimitado } from '../decorators/limite-plan.decorator';

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
 *
 * **Es un fast-fail, NO la garantía del límite.** Corre antes del
 * handler y en otra conexión que el INSERT, así que requests paralelas
 * pueden pasarlo todas a la vez. La garantía atómica es
 * `LimitesPlanService.asegurarDentroDelLimite()`, que cada service llama
 * dentro de la transacción que crea el registro.
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

    const idNegocio = this.extraerIdNegocio(context);
    if (!(await this.limitesPlan.estaEnPlanGratis(idNegocio))) return true;

    const conteo = await this.limitesPlan.contar(recurso, idNegocio);
    if (conteo >= this.limitesPlan.limite(recurso)) {
      throw this.limitesPlan.errorLimiteAlcanzado(recurso, I18nContext.current(context)?.lang);
    }
    return true;
  }

  /**
   * Transporte-agnóstico desde la tarjeta del Chatbot: además de HTTP
   * (`request.user.idNegocio`), soporta WebSocket
   * (`client.data.user.idNegocio`, lo deja `WsJwtGuard`) — mismo guard,
   * sin duplicarlo para el gateway.
   */
  private extraerIdNegocio(context: ExecutionContext): string {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<Socket>();
      return (client.data.user as JwtPayload).idNegocio;
    }
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user.idNegocio;
  }
}
