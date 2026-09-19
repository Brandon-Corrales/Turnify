import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Between,
  DataSource,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import {
  InjectTenantRepository,
  TenantContextService,
  TenantScopedRepository,
} from '../../common/tenant';
import { PaginatedResult } from '../../common/pagination';
import { aMomentoLocalCR } from '../../common/utils/zona-horaria-negocio';
import {
  Cliente,
  Disponibilidad,
  EstadoReserva,
  OrigenReserva,
  Reserva,
  Servicio,
  Usuario,
} from '../../database/entities';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
import { ListarReservasQueryDto } from './dto/listar-reservas-query.dto';

const isExclusionViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23P01';

const TRASLAPE_ERROR = {
  errorCode: 'RESERVA_TRASLAPADA',
  message: 'Ese usuario ya tiene una reserva en ese horario',
} as const;

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectTenantRepository(Reserva) private readonly reservaRepo: TenantScopedRepository<Reserva>,
    @InjectTenantRepository(Cliente) private readonly clienteRepo: TenantScopedRepository<Cliente>,
    @InjectTenantRepository(Servicio)
    private readonly servicioRepo: TenantScopedRepository<Servicio>,
    @InjectTenantRepository(Usuario) private readonly usuarioRepo: TenantScopedRepository<Usuario>,
    @InjectTenantRepository(Disponibilidad)
    private readonly disponibilidadRepo: TenantScopedRepository<Disponibilidad>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async crear(dto: CrearReservaDto): Promise<Reserva> {
    const idNegocio = this.tenantContext.idNegocio;

    const servicio = await this.servicioRepo.findOne({
      where: { idServicio: dto.idServicio } as any,
    });
    if (!servicio) {
      throw new NotFoundException({
        errorCode: 'SERVICIO_NO_ENCONTRADO',
        message: 'Servicio no encontrado',
      });
    }
    const cliente = await this.clienteRepo.findOne({ where: { idCliente: dto.idCliente } as any });
    if (!cliente) {
      throw new NotFoundException({
        errorCode: 'CLIENTE_NO_ENCONTRADO',
        message: 'Cliente no encontrado',
      });
    }
    const usuario = await this.usuarioRepo.findOne({ where: { idUsuario: dto.idUsuario } as any });
    if (!usuario) {
      throw new NotFoundException({
        errorCode: 'USUARIO_NO_ENCONTRADO',
        message: 'Usuario no encontrado',
      });
    }

    const fechaHoraInicio = new Date(dto.fechaHoraInicio);
    this.asegurarNoEsPasado(
      fechaHoraInicio,
      'FECHA_EN_EL_PASADO',
      'No se puede reservar en una fecha/hora que ya pasó',
    );
    const fechaHoraFin = new Date(fechaHoraInicio.getTime() + servicio.duracionMinutos * 60_000);

    await this.asegurarDentroDeDisponibilidad(dto.idUsuario, fechaHoraInicio, fechaHoraFin);

    return this.dataSource.transaction(async (manager) => {
      // Serializa por usuario: dos requests concurrentes para el MISMO
      // usuario nunca corren la validación de traslapes en paralelo (el
      // lock se libera solo al terminar la transacción). El EXCLUDE
      // constraint de la migración es la red de seguridad final, por si
      // esto llegara a fallar de todos modos.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [dto.idUsuario]);

      const traslapes = await manager.find(Reserva, {
        where: {
          idNegocio,
          idUsuario: dto.idUsuario,
          estado: Not(EstadoReserva.CANCELADA),
          fechaHoraInicio: LessThan(fechaHoraFin),
          fechaHoraFin: MoreThan(fechaHoraInicio),
        },
      });
      if (traslapes.length > 0) {
        throw new ConflictException(TRASLAPE_ERROR);
      }

      try {
        const reserva = manager.create(Reserva, {
          idNegocio,
          idCliente: dto.idCliente,
          idServicio: dto.idServicio,
          idUsuario: dto.idUsuario,
          fechaHoraInicio,
          fechaHoraFin,
          estado: EstadoReserva.CONFIRMADA,
          notas: dto.notas,
          origen: dto.origen ?? OrigenReserva.ADMIN,
        });
        const guardada = await manager.save(reserva);
        this.logger.log(`Reserva ${guardada.idReserva} creada para usuario ${dto.idUsuario}`);
        return guardada;
      } catch (err) {
        if (isExclusionViolation(err)) throw new ConflictException(TRASLAPE_ERROR);
        throw err;
      }
    });
  }

  async listar(query: ListarReservasQueryDto): Promise<PaginatedResult<Reserva>> {
    const { page, limit, idUsuario, idCliente, estado, desde, hasta } = query;
    const where: Record<string, unknown> = {};
    if (idUsuario) where.idUsuario = idUsuario;
    if (idCliente) where.idCliente = idCliente;
    if (estado) where.estado = estado;
    if (desde && hasta) where.fechaHoraInicio = Between(new Date(desde), new Date(hasta));
    else if (desde) where.fechaHoraInicio = MoreThanOrEqual(new Date(desde));
    else if (hasta) where.fechaHoraInicio = LessThanOrEqual(new Date(hasta));

    const [reservas, total] = await this.reservaRepo.findAndCount({
      where: where as any,
      // El calendario del frontend necesita nombre de cliente, nombre/color
      // del servicio y nombre del empleado para mostrar algo útil — sin
      // esto solo tendría los UUID crudos de las FK.
      relations: { cliente: true, servicio: true, usuario: true },
      order: { fechaHoraInicio: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: reservas, total, page, limit };
  }

  async obtenerUna(idReserva: string): Promise<Reserva> {
    return this.buscarOFallar(idReserva);
  }

  async cancelar(idReserva: string): Promise<Reserva> {
    const reserva = await this.buscarOFallar(idReserva);
    if (reserva.estado === EstadoReserva.CANCELADA) {
      throw new ConflictException({
        errorCode: 'RESERVA_YA_CANCELADA',
        message: 'Esta reserva ya estaba cancelada',
      });
    }
    await this.reservaRepo.update({ idReserva } as any, { estado: EstadoReserva.CANCELADA } as any);
    this.logger.log(`Reserva ${idReserva} cancelada`);
    return this.buscarOFallar(idReserva);
  }

  async reprogramar(idReserva: string, dto: ReprogramarReservaDto): Promise<Reserva> {
    const idNegocio = this.tenantContext.idNegocio;
    const actual = await this.buscarOFallar(idReserva);
    if (actual.estado === EstadoReserva.CANCELADA) {
      throw new ConflictException({
        errorCode: 'RESERVA_CANCELADA',
        message: 'No se puede reprogramar una reserva cancelada',
      });
    }

    const servicio = await this.servicioRepo.findOne({
      where: { idServicio: actual.idServicio } as any,
    });
    if (!servicio) {
      throw new NotFoundException({
        errorCode: 'SERVICIO_NO_ENCONTRADO',
        message: 'Servicio no encontrado',
      });
    }

    const fechaHoraInicio = new Date(dto.fechaHoraInicio);
    this.asegurarNoEsPasado(
      fechaHoraInicio,
      'FECHA_EN_EL_PASADO',
      'No se puede reprogramar a una fecha/hora que ya pasó',
    );
    const fechaHoraFin = new Date(fechaHoraInicio.getTime() + servicio.duracionMinutos * 60_000);

    await this.asegurarDentroDeDisponibilidad(actual.idUsuario, fechaHoraInicio, fechaHoraFin);

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [actual.idUsuario]);

      const traslapes = await manager.find(Reserva, {
        where: {
          idNegocio,
          idUsuario: actual.idUsuario,
          idReserva: Not(idReserva),
          estado: Not(EstadoReserva.CANCELADA),
          fechaHoraInicio: LessThan(fechaHoraFin),
          fechaHoraFin: MoreThan(fechaHoraInicio),
        },
      });
      if (traslapes.length > 0) {
        throw new ConflictException(TRASLAPE_ERROR);
      }

      try {
        await manager.update(Reserva, { idReserva }, { fechaHoraInicio, fechaHoraFin });
      } catch (err) {
        if (isExclusionViolation(err)) throw new ConflictException(TRASLAPE_ERROR);
        throw err;
      }
      this.logger.log(`Reserva ${idReserva} reprogramada`);
      return manager.findOneOrFail(Reserva, { where: { idReserva } });
    });
  }

  private asegurarNoEsPasado(fecha: Date, errorCode: string, message: string): void {
    if (fecha.getTime() < Date.now()) {
      throw new BadRequestException({ errorCode, message });
    }
  }

  /** Valida que [inicio, fin) caiga dentro de una franja activa de DISPONIBILIDAD del usuario, en hora local de Costa Rica. */
  private async asegurarDentroDeDisponibilidad(
    idUsuario: string,
    inicio: Date,
    fin: Date,
  ): Promise<void> {
    const { diaSemana, horaMinuto: horaInicio } = aMomentoLocalCR(inicio);
    const { diaSemana: diaFin, horaMinuto: horaFin } = aMomentoLocalCR(fin);
    if (diaFin !== diaSemana) {
      throw new BadRequestException({
        errorCode: 'RESERVA_CRUZA_MEDIANOCHE',
        message: 'La reserva no puede cruzar la medianoche',
      });
    }

    const disponibilidad = await this.disponibilidadRepo.find({
      where: {
        idUsuario,
        diaSemana,
        activo: true,
        horaInicio: LessThanOrEqual(horaInicio),
        horaFin: MoreThanOrEqual(horaFin),
      } as any,
    });
    if (disponibilidad.length === 0) {
      throw new ConflictException({
        errorCode: 'FUERA_DE_DISPONIBILIDAD',
        message: 'Ese horario está fuera de la disponibilidad registrada del usuario',
      });
    }
  }

  private async buscarOFallar(idReserva: string): Promise<Reserva> {
    const reserva = await this.reservaRepo.findOne({
      where: { idReserva } as any,
      relations: { cliente: true, servicio: true, usuario: true },
    });
    if (!reserva) {
      throw new NotFoundException({
        errorCode: 'RESERVA_NO_ENCONTRADA',
        message: 'Reserva no encontrada',
      });
    }
    return reserva;
  }
}
