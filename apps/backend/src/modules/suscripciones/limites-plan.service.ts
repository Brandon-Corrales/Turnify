import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  MensajeChatbot,
  Negocio,
  PlanSuscripcion,
  Reserva,
  Servicio,
  Usuario,
} from '../../database/entities';
import { RecursoLimitado } from './decorators/limite-plan.decorator';

/**
 * Límites reales del Plan Gratis (punto 5.1 del brief — "el equipo ajusta
 * los números exactos, pero deben existir límites reales, no solo de
 * nombre"). Usa los mismos valores de ejemplo del brief.
 */
const LIMITES_PLAN_GRATIS: Record<RecursoLimitado, number> = {
  usuarios: 1, // solo el admin, sin poder invitar empleados
  servicios: 3, // servicios activos
  reservas: 20, // por mes calendario
  mensajesChatbot: 10, // por día calendario
};

/**
 * Lógica de conteo separada de LimitePlanGratisGuard a propósito: un
 * guard aplicado vía @UseGuards(ClaseGuard) se instancia por cada módulo
 * consumidor usando el propio inyector de ESE módulo, así que si el guard
 * mismo dependiera directo de estos Repository, fallaría en
 * UsuariosModule/ServiciosModule/ReservasModule (no tienen
 * TypeOrmModule.forFeature(Negocio/...) registrado). Este servicio, en
 * cambio, es una dependencia normal exportada por SuscripcionesModule —
 * sigue la resolución de DI estándar de Nest sin ese problema.
 */
@Injectable()
export class LimitesPlanService {
  constructor(
    @InjectRepository(Negocio) private readonly negocioRepo: Repository<Negocio>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Servicio) private readonly servicioRepo: Repository<Servicio>,
    @InjectRepository(Reserva) private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(MensajeChatbot)
    private readonly mensajeChatbotRepo: Repository<MensajeChatbot>,
  ) {}

  async estaEnPlanGratis(idNegocio: string): Promise<boolean> {
    const negocio = await this.negocioRepo.findOne({ where: { idNegocio } });
    return !negocio || negocio.planSuscripcion === PlanSuscripcion.GRATIS;
  }

  limite(recurso: RecursoLimitado): number {
    return LIMITES_PLAN_GRATIS[recurso];
  }

  async contar(recurso: RecursoLimitado, idNegocio: string): Promise<number> {
    switch (recurso) {
      case 'usuarios':
        return this.usuarioRepo.count({ where: { idNegocio, activo: true } });
      case 'servicios':
        return this.servicioRepo.count({ where: { idNegocio, activo: true } });
      case 'reservas': {
        // Mes calendario en UTC: la cuota es una franja gruesa (20/mes),
        // no algo sensible a unas horas de diferencia con la hora local
        // de Costa Rica — no vale la pena la complejidad de convertir a
        // límites de mes en hora CR para esto.
        const ahora = new Date();
        const inicioDeMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
        return this.reservaRepo.count({
          where: { idNegocio, creadoEn: MoreThanOrEqual(inicioDeMes) },
        });
      }
      case 'mensajesChatbot': {
        const ahora = new Date();
        const inicioDeHoy = new Date(
          Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
        );
        return this.mensajeChatbotRepo.count({
          where: { idNegocio, creadoEn: MoreThanOrEqual(inicioDeHoy) },
        });
      }
    }
  }
}
