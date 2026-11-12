import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { EntityManager, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  EstadoReserva,
  MensajeChatbot,
  Negocio,
  PlanSuscripcion,
  Reserva,
  Servicio,
  Usuario,
} from '../../database/entities';
import { RecursoLimitado } from './decorators/limite-plan.decorator';
import { leerZonaHoraria } from '../../common/utils/leer-zona-horaria';
import { inicioDelDiaActual, inicioDelMesActual } from '../../common/utils/zona-horaria-negocio';

/**
 * Límites reales del Plan Gratis (punto 5.1 del brief — "el equipo ajusta
 * los números exactos, pero deben existir límites reales, no solo de
 * nombre"). Usa los mismos valores de ejemplo del brief.
 */
const LIMITES_PLAN_GRATIS: Record<RecursoLimitado, number> = {
  usuarios: 1, // solo el admin, sin poder invitar empleados
  servicios: 3, // servicios activos
  reservas: 20, // por mes calendario de la zona del negocio, sin contar las canceladas
  mensajesChatbot: 10, // por día calendario de la zona del negocio
};

/**
 * errorCode siempre 'LIMITE_PLAN_ALCANZADO' (el que da de ejemplo el
 * brief), pero el MENSAJE varía por recurso — un solo código con 4
 * traducciones distintas, no 4 códigos.
 */
const CLAVE_I18N_POR_RECURSO: Record<RecursoLimitado, string> = {
  usuarios: 'errores.LIMITE_PLAN_USUARIOS',
  servicios: 'errores.LIMITE_PLAN_SERVICIOS',
  reservas: 'errores.LIMITE_PLAN_RESERVAS',
  mensajesChatbot: 'errores.LIMITE_PLAN_MENSAJES_CHATBOT',
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
    private readonly i18n: I18nService,
  ) {}

  async estaEnPlanGratis(idNegocio: string, manager?: EntityManager): Promise<boolean> {
    const repo = manager ? manager.getRepository(Negocio) : this.negocioRepo;
    const negocio = await repo.findOne({ where: { idNegocio } });
    return !negocio || negocio.planSuscripcion === PlanSuscripcion.GRATIS;
  }

  errorLimiteAlcanzado(recurso: RecursoLimitado, lang?: string): ForbiddenException {
    return new ForbiddenException({
      errorCode: 'LIMITE_PLAN_ALCANZADO',
      message: this.i18n.translate(CLAVE_I18N_POR_RECURSO[recurso], {
        lang: lang ?? I18nContext.current()?.lang,
        defaultValue: `Límite del Plan Gratis alcanzado (${recurso})`,
      }),
    });
  }

  /**
   * Chequeo ATÓMICO del límite, para llamar dentro de la MISMA transacción
   * que hace el INSERT. LimitePlanGratisGuard solo no alcanza: corre
   * antes del handler, en otra conexión, así que N requests simultáneas
   * cuentan todas "por debajo del límite" antes de que ninguna inserte
   * (bug real de la prueba de humo del Seguimiento #3: el onboarding creó
   * 4 servicios en Plan Gratis con 4 POST en paralelo).
   *
   * Mismo mecanismo que ReservasService contra el doble-booking:
   * `pg_advisory_xact_lock` por (recurso, negocio) serializa a las
   * requests que compiten por el mismo cupo; el lock se libera solo al
   * terminar la transacción, cuando el INSERT ya está confirmado, y el
   * COUNT de la siguiente (READ COMMITTED, snapshot nuevo por sentencia)
   * ya lo ve. Una constraint de BD no sirve aquí: "máximo 3 filas activas
   * SOLO si el plan es gratis" necesitaría un trigger que duplique en SQL
   * los límites que viven en este archivo.
   */
  async asegurarDentroDelLimite(
    manager: EntityManager,
    recurso: RecursoLimitado,
    idNegocio: string,
  ): Promise<void> {
    if (!(await this.estaEnPlanGratis(idNegocio, manager))) return;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `limite-plan:${recurso}:${idNegocio}`,
    ]);
    if ((await this.contar(recurso, idNegocio, manager)) >= this.limite(recurso)) {
      throw this.errorLimiteAlcanzado(recurso);
    }
  }

  limite(recurso: RecursoLimitado): number {
    return LIMITES_PLAN_GRATIS[recurso];
  }

  private zonaDe(idNegocio: string, manager?: EntityManager): Promise<string> {
    return leerZonaHoraria(manager ? manager.getRepository(Negocio) : this.negocioRepo, idNegocio);
  }

  async contar(
    recurso: RecursoLimitado,
    idNegocio: string,
    manager?: EntityManager,
  ): Promise<number> {
    switch (recurso) {
      case 'usuarios':
        return (manager ? manager.getRepository(Usuario) : this.usuarioRepo).count({
          where: { idNegocio, activo: true },
        });
      case 'servicios':
        return (manager ? manager.getRepository(Servicio) : this.servicioRepo).count({
          where: { idNegocio, activo: true },
        });
      case 'reservas': {
        // Mes calendario en la zona del NEGOCIO (Bloque 5): antes era en UTC,
        // y en Costa Rica el mes "cambiaba" el último día a las 18:00.
        //
        // Las canceladas NO cuentan (decisión del grupo, Bloque 4 punto 4.4):
        // cancelar libera el cupo. Se cuenta por `creado_en`, así que
        // reprogramar (que solo cambia la hora) no la cuenta dos veces. Esta
        // misma función alimenta el límite (asegurarDentroDelLimite) y el
        // indicador de uso de la pantalla de Suscripción.
        const zona = await this.zonaDe(idNegocio, manager);
        const inicioDeMes = inicioDelMesActual(new Date(), zona);
        return (manager ? manager.getRepository(Reserva) : this.reservaRepo).count({
          where: {
            idNegocio,
            creadoEn: MoreThanOrEqual(inicioDeMes),
            estado: Not(EstadoReserva.CANCELADA),
          },
        });
      }
      case 'mensajesChatbot': {
        // Día calendario en la zona del negocio (Bloque 5). Solo cambia el
        // corte del día; el límite (10) es el mismo.
        const zona = await this.zonaDe(idNegocio, manager);
        const inicioDeHoy = inicioDelDiaActual(new Date(), zona);
        return (manager ? manager.getRepository(MensajeChatbot) : this.mensajeChatbotRepo).count({
          where: { idNegocio, creadoEn: MoreThanOrEqual(inicioDeHoy) },
        });
      }
    }
  }
}
