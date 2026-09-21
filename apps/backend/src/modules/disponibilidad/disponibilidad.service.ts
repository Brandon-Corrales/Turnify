import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LessThan, MoreThan, Not } from 'typeorm';
import {
  InjectTenantRepository,
  TenantContextService,
  TenantScopedRepository,
} from '../../common/tenant';
import { Disponibilidad, RolUsuario, Usuario } from '../../database/entities';
import { CrearDisponibilidadDto } from './dto/crear-disponibilidad.dto';
import { ActualizarDisponibilidadDto } from './dto/actualizar-disponibilidad.dto';

@Injectable()
export class DisponibilidadService {
  private readonly logger = new Logger(DisponibilidadService.name);

  constructor(
    @InjectTenantRepository(Disponibilidad)
    private readonly disponibilidadRepo: TenantScopedRepository<Disponibilidad>,
    @InjectTenantRepository(Usuario) private readonly usuarioRepo: TenantScopedRepository<Usuario>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async crear(dto: CrearDisponibilidadDto): Promise<Disponibilidad> {
    this.asegurarPuedeGestionar(dto.idUsuario);
    this.asegurarRangoValido(dto.horaInicio, dto.horaFin);
    await this.asegurarUsuarioExiste(dto.idUsuario);
    await this.asegurarSinTraslape(dto.idUsuario, dto.diaSemana, dto.horaInicio, dto.horaFin);

    const disponibilidad = await this.disponibilidadRepo.save(this.disponibilidadRepo.create(dto));
    this.logger.log(
      `Disponibilidad ${disponibilidad.idDisponibilidad} creada para usuario ${dto.idUsuario}`,
    );
    return disponibilidad;
  }

  async listar(idUsuarioFiltro?: string): Promise<Disponibilidad[]> {
    return this.disponibilidadRepo.find({
      where: idUsuarioFiltro ? ({ idUsuario: idUsuarioFiltro } as any) : {},
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
  }

  async obtenerUno(idDisponibilidad: string): Promise<Disponibilidad> {
    return this.buscarOFallar(idDisponibilidad);
  }

  async actualizar(
    idDisponibilidad: string,
    dto: ActualizarDisponibilidadDto,
  ): Promise<Disponibilidad> {
    const actual = await this.buscarOFallar(idDisponibilidad);
    this.asegurarPuedeGestionar(actual.idUsuario);

    const horaInicio = dto.horaInicio ?? actual.horaInicio;
    const horaFin = dto.horaFin ?? actual.horaFin;
    const diaSemana = dto.diaSemana ?? actual.diaSemana;
    this.asegurarRangoValido(horaInicio, horaFin);
    await this.asegurarSinTraslape(
      actual.idUsuario,
      diaSemana,
      horaInicio,
      horaFin,
      idDisponibilidad,
    );

    await this.disponibilidadRepo.update({ idDisponibilidad } as any, dto as any);
    this.logger.log(`Disponibilidad ${idDisponibilidad} actualizada`);
    return this.buscarOFallar(idDisponibilidad);
  }

  async desactivar(idDisponibilidad: string): Promise<void> {
    const actual = await this.buscarOFallar(idDisponibilidad);
    this.asegurarPuedeGestionar(actual.idUsuario);
    // Disponibilidad no tiene soft delete propio (sin eliminado_en en el
    // ER) — `activo:false` es el mecanismo de baja de esta entidad.
    await this.disponibilidadRepo.update({ idDisponibilidad } as any, { activo: false } as any);
    this.logger.log(`Disponibilidad ${idDisponibilidad} desactivada`);
  }

  /** Un empleado solo gestiona su propio horario; un admin gestiona el de cualquiera del negocio. */
  private asegurarPuedeGestionar(idUsuarioObjetivo: string): void {
    const { idUsuario, rol } = this.tenantContext.context;
    if (rol !== RolUsuario.ADMIN && idUsuario !== idUsuarioObjetivo) {
      throw new ForbiddenException({
        errorCode: 'DISPONIBILIDAD_AJENA',
        message: 'Solo puedes gestionar tu propio horario de disponibilidad',
      });
    }
  }

  private asegurarRangoValido(horaInicio: string, horaFin: string): void {
    if (horaInicio >= horaFin) {
      throw new BadRequestException({
        errorCode: 'RANGO_HORARIO_INVALIDO',
        message: 'La hora de fin debe ser posterior a la hora de inicio',
        field: 'horaFin',
      });
    }
  }

  private async asegurarUsuarioExiste(idUsuario: string): Promise<void> {
    const usuario = await this.usuarioRepo.findOne({ where: { idUsuario } as any });
    if (!usuario) {
      throw new NotFoundException({
        errorCode: 'USUARIO_NO_ENCONTRADO',
        message: 'Usuario no encontrado',
      });
    }
  }

  /**
   * Traslape entre rangos [horaInicio, horaFin) del mismo usuario y día:
   * dos rangos se solapan si existente.horaInicio < nuevo.horaFin Y
   * existente.horaFin > nuevo.horaInicio.
   */
  private async asegurarSinTraslape(
    idUsuario: string,
    diaSemana: number,
    horaInicio: string,
    horaFin: string,
    idExcluido?: string,
  ): Promise<void> {
    const traslapes = await this.disponibilidadRepo.find({
      where: {
        idUsuario,
        diaSemana,
        activo: true,
        horaInicio: LessThan(horaFin),
        horaFin: MoreThan(horaInicio),
        ...(idExcluido ? { idDisponibilidad: Not(idExcluido) } : {}),
      } as any,
    });
    if (traslapes.length > 0) {
      throw new ConflictException({
        errorCode: 'DISPONIBILIDAD_TRASLAPADA',
        message:
          'Ese horario se traslapa con otra disponibilidad ya registrada para este usuario ese día',
      });
    }
  }

  private async buscarOFallar(idDisponibilidad: string): Promise<Disponibilidad> {
    const disponibilidad = await this.disponibilidadRepo.findOne({
      where: { idDisponibilidad } as any,
    });
    if (!disponibilidad) {
      throw new NotFoundException({
        errorCode: 'DISPONIBILIDAD_NO_ENCONTRADA',
        message: 'Disponibilidad no encontrada',
      });
    }
    return disponibilidad;
  }
}
