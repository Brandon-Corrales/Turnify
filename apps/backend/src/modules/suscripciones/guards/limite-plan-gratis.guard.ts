import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nContext, I18nService } from 'nestjs-i18n';
import type { Socket } from 'socket.io';
import type { AuthenticatedRequest, JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { LimitesPlanService } from '../limites-plan.service';
import { LIMITE_PLAN_KEY, RecursoLimitado } from '../decorators/limite-plan.decorator';

/**
 * errorCode siempre 'LIMITE_PLAN_ALCANZADO' (el que da de ejemplo el
 * brief), pero el MENSAJE varía por recurso — un solo código con 4
 * traducciones distintas, no 4 códigos. Traducido explícito aquí (no vía
 * AllExceptionsFilter.traducir()) porque ese mecanismo busca una única
 * clave `errores.<errorCode>`, y aquí necesitamos elegir la clave según
 * el `recurso`, no según el errorCode.
 */
const CLAVE_I18N_POR_RECURSO: Record<RecursoLimitado, string> = {
  usuarios: 'errores.LIMITE_PLAN_USUARIOS',
  servicios: 'errores.LIMITE_PLAN_SERVICIOS',
  reservas: 'errores.LIMITE_PLAN_RESERVAS',
  mensajesChatbot: 'errores.LIMITE_PLAN_MENSAJES_CHATBOT',
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
    private readonly i18n: I18nService,
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
      throw new ForbiddenException({
        errorCode: 'LIMITE_PLAN_ALCANZADO',
        message: this.i18n.translate(CLAVE_I18N_POR_RECURSO[recurso], {
          lang: I18nContext.current(context)?.lang,
          defaultValue: `Límite del Plan Gratis alcanzado (${recurso})`,
        }),
      });
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
