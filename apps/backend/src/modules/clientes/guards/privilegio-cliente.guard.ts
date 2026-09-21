import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CanalPreferido, NivelCliente } from '../../../database/entities';
import type { AuthenticatedRequest } from '../../auth/interfaces/jwt-payload.interface';
import { PrivilegiosClienteService } from '../privilegios-cliente.service';

interface BodyConCanal {
  canalPreferido?: CanalPreferido;
  nivelCliente?: NivelCliente;
}

/**
 * Guard transversal (mismo patrón que LimitePlanGratisGuard): se aplica
 * en POST/PATCH de /clientes vía @UseGuards, en vez de repetir esta
 * validación dentro de ClientesService. El idNegocio sale de
 * `request.user` (lo pone JwtAuthGuard, que corre en la misma fase de
 * Guards) — nunca de TenantContextService, que todavía no existe en la
 * fase de Guards (ver el comentario largo en LimitePlanGratisGuard).
 */
@Injectable()
export class PrivilegioClienteGuard implements CanActivate {
  constructor(private readonly privilegios: PrivilegiosClienteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { body: BodyConCanal; params: { id?: string } }>();

    if (request.body.canalPreferido !== CanalPreferido.WHATSAPP) return true;

    await this.privilegios.verificarCanalWhatsapp(
      request.user.idNegocio,
      request.params.id,
      request.body.nivelCliente,
    );
    return true;
  }
}
