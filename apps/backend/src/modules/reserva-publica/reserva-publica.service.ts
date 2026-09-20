import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import {
  InjectTenantRepository,
  TenantContextService,
  TenantScopedRepository,
} from '../../common/tenant';
import {
  Disponibilidad,
  EstadoReserva,
  OrigenReserva,
  Reserva,
  RolUsuario,
  Usuario,
} from '../../database/entities';
import {
  aMomentoLocalCR,
  horaMinutoADate,
  inicioDeDiaLocalCR,
} from '../../common/utils/zona-horaria-negocio';
import { ClientesService } from '../clientes/clientes.service';
import { NegociosService } from '../negocios/negocios.service';
import { ServiciosService } from '../servicios/servicios.service';
import { ReservasService } from '../reservas/reservas.service';
import { LimitesPlanService } from '../suscripciones/limites-plan.service';
import { CrearReservaPublicaDto } from './dto/crear-reserva-publica.dto';

const USUARIO_SISTEMA_PUBLICO = 'sistema-reserva-publica';

export interface NegocioPublico {
  idNegocio: string;
  nombre: string;
  tipoNegocio: string;
}

export interface ServicioPublico {
  idServicio: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precio: string;
  colorCalendario?: string;
}

/**
 * Orquesta el flujo de reserva pública (wizard de 4 pasos, punto 6 del
 * brief) SIN sesión — a diferencia del resto de módulos, `idNegocio`
 * viene de la URL, no de un JWT. En vez de duplicar la lógica de
 * disponibilidad/traslapes/notificaciones ya construida y probada en
 * ReservasService, cada método abre un TenantContext "sintético" para el
 * idNegocio del path (idUsuario/rol son placeholders sin uso real fuera
 * de filtrar por idNegocio) y dentro reutiliza los services existentes
 * tal cual los usaría un admin autenticado — así ningún cambio futuro a
 * esas reglas de negocio puede desincronizarse entre el flujo interno y
 * el público.
 */
@Injectable()
export class ReservaPublicaService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly negociosService: NegociosService,
    private readonly serviciosService: ServiciosService,
    private readonly clientesService: ClientesService,
    private readonly reservasService: ReservasService,
    private readonly limitesPlan: LimitesPlanService,
    private readonly i18n: I18nService,
    @InjectTenantRepository(Usuario) private readonly usuarioRepo: TenantScopedRepository<Usuario>,
    @InjectTenantRepository(Disponibilidad)
    private readonly disponibilidadRepo: TenantScopedRepository<Disponibilidad>,
    @InjectTenantRepository(Reserva) private readonly reservaRepo: TenantScopedRepository<Reserva>,
  ) {}

  private conContexto<T>(idNegocio: string, fn: () => Promise<T>): Promise<T> {
    return this.tenantContext.run(
      { idNegocio, idUsuario: USUARIO_SISTEMA_PUBLICO, rol: RolUsuario.ADMIN },
      fn,
    );
  }

  async obtenerNegocio(idNegocio: string): Promise<NegocioPublico> {
    return this.conContexto(idNegocio, async () => {
      const negocio = await this.negociosService.obtenerMiNegocio();
      return {
        idNegocio: negocio.idNegocio,
        nombre: negocio.nombre,
        tipoNegocio: negocio.tipoNegocio,
      };
    });
  }

  async listarServicios(idNegocio: string): Promise<ServicioPublico[]> {
    return this.conContexto(idNegocio, async () => {
      const { data } = await this.serviciosService.listar({ page: 1, limit: 100 });
      return data.map((s) => ({
        idServicio: s.idServicio,
        nombre: s.nombre,
        descripcion: s.descripcion,
        duracionMinutos: s.duracionMinutos,
        precio: s.precio,
        colorCalendario: s.colorCalendario,
      }));
    });
  }

  async listarHorarios(idNegocio: string, idServicio: string, fecha: string): Promise<string[]> {
    return this.conContexto(idNegocio, async () => {
      const servicio = await this.serviciosService.obtenerUno(idServicio);
      const inicioDeDia = inicioDeDiaLocalCR(fecha);
      const { diaSemana } = aMomentoLocalCR(inicioDeDia);
      const finDeDia = new Date(inicioDeDia.getTime() + 24 * 60 * 60 * 1000);

      const [usuarios, disponibilidades, reservasDelDia] = await Promise.all([
        this.usuarioRepo.find({ where: { activo: true } as any }),
        this.disponibilidadRepo.find({ where: { diaSemana, activo: true } as any }),
        this.reservaRepo.find({
          where: {
            estado: Not(EstadoReserva.CANCELADA),
            fechaHoraInicio: MoreThanOrEqual(inicioDeDia),
            fechaHoraFin: LessThanOrEqual(finDeDia),
          } as any,
        }),
      ]);
      const idsUsuariosActivos = new Set(usuarios.map((u) => u.idUsuario));

      const horariosDisponibles = new Set<string>();
      for (const disponibilidad of disponibilidades) {
        if (!idsUsuariosActivos.has(disponibilidad.idUsuario)) continue;
        const slots = this.generarSlotsDeVentana(
          inicioDeDia,
          disponibilidad.horaInicio,
          disponibilidad.horaFin,
          servicio.duracionMinutos,
        );
        for (const { inicio, fin } of slots) {
          if (inicio.getTime() < Date.now()) continue;
          const libre = !reservasDelDia.some(
            (r) =>
              r.idUsuario === disponibilidad.idUsuario &&
              r.fechaHoraInicio < fin &&
              r.fechaHoraFin > inicio,
          );
          if (libre) horariosDisponibles.add(inicio.toISOString());
        }
      }
      return [...horariosDisponibles].sort();
    });
  }

  async crearReserva(idNegocio: string, dto: CrearReservaPublicaDto) {
    return this.conContexto(idNegocio, async () => {
      await this.asegurarDentroDelLimiteDelPlan(idNegocio);

      const servicio = await this.serviciosService.obtenerUno(dto.idServicio);
      const fechaHoraInicio = new Date(dto.fechaHoraInicio);
      const fechaHoraFin = new Date(fechaHoraInicio.getTime() + servicio.duracionMinutos * 60_000);

      const idUsuario = await this.encontrarUsuarioDisponible(fechaHoraInicio, fechaHoraFin);
      if (!idUsuario) {
        throw new NotFoundException({
          errorCode: 'HORARIO_NO_DISPONIBLE',
          message: 'Ese horario ya no está disponible, elige otro',
        });
      }

      let cliente = await this.clientesService.buscarPorCorreo(dto.cliente.correoElectronico);
      if (!cliente) {
        cliente = await this.clientesService.crear({
          nombreCompleto: dto.cliente.nombreCompleto,
          correoElectronico: dto.cliente.correoElectronico,
          telefono: dto.cliente.telefono,
        });
      }

      return this.reservasService.crear({
        idCliente: cliente.idCliente,
        idServicio: dto.idServicio,
        idUsuario,
        fechaHoraInicio: dto.fechaHoraInicio,
        origen: OrigenReserva.ONLINE,
      });
    });
  }

  /** Mismo criterio que LimitePlanGratisGuard para el recurso 'reservas' — no aplica el guard porque este endpoint es público (sin request.user), así que se replica el chequeo explícito con la MISMA fuente (LimitesPlanService). */
  private async asegurarDentroDelLimiteDelPlan(idNegocio: string): Promise<void> {
    if (!(await this.limitesPlan.estaEnPlanGratis(idNegocio))) return;
    const conteo = await this.limitesPlan.contar('reservas', idNegocio);
    if (conteo >= this.limitesPlan.limite('reservas')) {
      throw new ForbiddenException({
        errorCode: 'LIMITE_PLAN_ALCANZADO',
        message: this.i18n.translate('errores.LIMITE_PLAN_RESERVAS', {
          lang: I18nContext.current()?.lang,
          defaultValue: 'Límite del Plan Gratis alcanzado (reservas)',
        }),
      });
    }
  }

  private async encontrarUsuarioDisponible(inicio: Date, fin: Date): Promise<string | null> {
    const { diaSemana, horaMinuto: horaInicio } = aMomentoLocalCR(inicio);
    const { diaSemana: diaFin, horaMinuto: horaFin } = aMomentoLocalCR(fin);
    if (diaFin !== diaSemana) return null;

    const [usuarios, disponibilidades, traslapes] = await Promise.all([
      this.usuarioRepo.find({ where: { activo: true } as any }),
      this.disponibilidadRepo.find({
        where: {
          diaSemana,
          activo: true,
          horaInicio: LessThanOrEqual(horaInicio),
          horaFin: MoreThanOrEqual(horaFin),
        } as any,
      }),
      this.reservaRepo.find({
        where: {
          estado: Not(EstadoReserva.CANCELADA),
          fechaHoraInicio: MoreThanOrEqual(new Date(inicio.getTime() - 24 * 60 * 60 * 1000)),
        } as any,
      }),
    ]);
    const idsUsuariosActivos = new Set(usuarios.map((u) => u.idUsuario));

    for (const disponibilidad of disponibilidades) {
      if (!idsUsuariosActivos.has(disponibilidad.idUsuario)) continue;
      const ocupado = traslapes.some(
        (r) =>
          r.idUsuario === disponibilidad.idUsuario &&
          r.fechaHoraInicio < fin &&
          r.fechaHoraFin > inicio,
      );
      if (!ocupado) return disponibilidad.idUsuario;
    }
    return null;
  }

  /** Genera slots de [inicio, inicio+duracion) espaciados por la duración del servicio, sin que ninguno pase de horaFin. */
  private generarSlotsDeVentana(
    inicioDeDia: Date,
    horaInicio: string,
    horaFin: string,
    duracionMinutos: number,
  ): Array<{ inicio: Date; fin: Date }> {
    const [hIni, mIni] = horaInicio.split(':').map(Number);
    const [hFin, mFin] = horaFin.split(':').map(Number);
    const minutoInicio = hIni * 60 + mIni;
    const minutoFin = hFin * 60 + mFin;

    const slots: Array<{ inicio: Date; fin: Date }> = [];
    for (let t = minutoInicio; t + duracionMinutos <= minutoFin; t += duracionMinutos) {
      const hh = String(Math.floor(t / 60)).padStart(2, '0');
      const mm = String(t % 60).padStart(2, '0');
      const inicio = horaMinutoADate(inicioDeDia, `${hh}:${mm}`);
      slots.push({ inicio, fin: new Date(inicio.getTime() + duracionMinutos * 60_000) });
    }
    return slots;
  }
}
