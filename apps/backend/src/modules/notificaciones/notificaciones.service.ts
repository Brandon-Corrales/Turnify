import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import {
  CanalNotificacion,
  CanalPreferido,
  Cliente,
  EstadoNotificacion,
  Notificacion,
  Reserva,
  Servicio,
  TipoNotificacion,
} from '../../database/entities';
import { formatearFechaHoraLocalCR } from '../../common/utils/zona-horaria-negocio';
import { construirMensaje } from './mensajes-notificacion';
import { ResendService } from './providers/resend.service';
import { WhatsappCloudApiService } from './providers/whatsapp-cloud-api.service';

/** Después de este número de reintentos fallidos, la notificación se marca FALLIDA en vez de reintentar por siempre. */
const MAX_REINTENTOS = 3;

const CANAL_POR_PREFERENCIA: Record<CanalPreferido, CanalNotificacion> = {
  [CanalPreferido.EMAIL]: CanalNotificacion.EMAIL,
  [CanalPreferido.WHATSAPP]: CanalNotificacion.WHATSAPP,
};

/**
 * Worker de Notificaciones (punto 3 del brief): separado del ciclo
 * request/response — un cron dentro del propio proceso de Nest revisa
 * NOTIFICACION.estado=pendiente y programado_para, y envía por Resend o
 * por la Cloud API de WhatsApp de Meta. Se eligió @nestjs/schedule
 * (node-cron por debajo) en vez de BullMQ+Redis: el brief autoriza este
 * fallback explícitamente, y el proyecto no tenía Redis en ningún lado
 * todavía — agregarlo solo para esto era infraestructura nueva sin un
 * beneficio claro para el alcance actual.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion) private readonly notificacionRepo: Repository<Notificacion>,
    private readonly resend: ResendService,
    private readonly whatsapp: WhatsappCloudApiService,
    private readonly i18n: I18nService,
  ) {}

  async programarConfirmacion(
    reserva: Reserva,
    cliente: Cliente,
    servicio: Servicio,
  ): Promise<void> {
    await this.programar(TipoNotificacion.CONFIRMACION, reserva, cliente, servicio);
  }

  async programarCancelacion(
    reserva: Reserva,
    cliente: Cliente,
    servicio: Servicio,
  ): Promise<void> {
    await this.programar(TipoNotificacion.CANCELACION, reserva, cliente, servicio);
  }

  private async programar(
    tipo: TipoNotificacion.CONFIRMACION | TipoNotificacion.CANCELACION,
    reserva: Reserva,
    cliente: Cliente,
    servicio: Servicio,
  ): Promise<void> {
    const { asunto, texto } = construirMensaje(this.i18n, tipo, cliente.idiomaPreferido, {
      nombreServicio: servicio.nombre,
      fechaHoraTexto: formatearFechaHoraLocalCR(reserva.fechaHoraInicio, cliente.idiomaPreferido),
    });
    const notificacion = this.notificacionRepo.create({
      idReserva: reserva.idReserva,
      idCliente: cliente.idCliente,
      tipo,
      canal: CANAL_POR_PREFERENCIA[cliente.canalPreferido],
      estado: EstadoNotificacion.PENDIENTE,
      programadoPara: new Date(),
      // El asunto (solo relevante para email) viaja como primera línea del
      // mensaje — el ER no tiene una columna separada para asunto y no
      // vale la pena una migración solo por eso.
      mensaje: `${asunto}\n${texto}`,
      reintentos: 0,
    });
    await this.notificacionRepo.save(notificacion);
    this.logger.log(`Notificación ${tipo} programada para cliente ${cliente.idCliente}`);
  }

  /**
   * Historial paginado del negocio actual (pantalla de Notificaciones,
   * punto 6 del brief). Notificacion no tiene idNegocio propio — se
   * filtra por join contra Cliente (que sí lo tiene), igual criterio que
   * el resto del servicio para esta entidad.
   */
  async listar(
    idNegocio: string,
    { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResult<Notificacion>> {
    const [data, total] = await this.notificacionRepo
      .createQueryBuilder('notificacion')
      .innerJoin('notificacion.cliente', 'cliente')
      .addSelect(['cliente.idCliente', 'cliente.nombreCompleto'])
      .leftJoinAndSelect('notificacion.reserva', 'reserva')
      .leftJoinAndSelect('reserva.servicio', 'servicio')
      .where('cliente.idNegocio = :idNegocio', { idNegocio })
      .orderBy('notificacion.creadoEn', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async procesarPendientes(): Promise<void> {
    const pendientes = await this.notificacionRepo.find({
      where: { estado: EstadoNotificacion.PENDIENTE, programadoPara: LessThanOrEqual(new Date()) },
      relations: { cliente: true },
      // El cliente puede haberse desactivado (soft-delete) DESPUÉS de
      // programar la notificación — sin esto TypeORM lo excluye del join
      // y notificacion.cliente llega null, reventando enviarUna() (bug
      // real, mismo patrón ya encontrado y arreglado en
      // ReservasService.listar()/obtenerUna(): el historial no debe
      // romperse porque un cliente se desactivó después).
      withDeleted: true,
      take: 50,
    });
    for (const notificacion of pendientes) {
      try {
        await this.enviarUna(notificacion);
      } catch (error) {
        // Una notificación con datos irrecuperables (p.ej. el cliente ya
        // no existe ni con withDeleted) nunca debe bloquear el resto del
        // lote — antes de este fix, un error sin atrapar acá cortaba el
        // `for` entero y dejaba sin procesar cualquier notificación real
        // que viniera después en el mismo lote de 50.
        this.logger.error(
          `Notificación ${notificacion.idNotificacion} no se pudo procesar: ${(error as Error).message}`,
        );
        await this.notificacionRepo.update(
          { idNotificacion: notificacion.idNotificacion },
          { estado: EstadoNotificacion.FALLIDA },
        );
      }
    }
  }

  private async enviarUna(notificacion: Notificacion): Promise<void> {
    const [asunto, ...resto] = notificacion.mensaje.split('\n');
    const texto = resto.join('\n');
    const cliente = notificacion.cliente;

    const resultado =
      notificacion.canal === CanalNotificacion.EMAIL
        ? await this.resend.enviarCorreo(cliente.correoElectronico, asunto, texto)
        : notificacion.canal === CanalNotificacion.WHATSAPP
          ? await this.whatsapp.enviarMensaje(cliente.telefono ?? '', texto)
          : { exito: false, error: `Canal ${notificacion.canal} no tiene proveedor implementado` };

    if (resultado.exito) {
      await this.notificacionRepo.update(
        { idNotificacion: notificacion.idNotificacion },
        { estado: EstadoNotificacion.ENVIADA, enviadoEn: new Date() },
      );
      this.logger.log(
        `Notificación ${notificacion.idNotificacion} enviada por ${notificacion.canal}`,
      );
      return;
    }

    const reintentos = notificacion.reintentos + 1;
    const agotada = reintentos >= MAX_REINTENTOS;
    await this.notificacionRepo.update(
      { idNotificacion: notificacion.idNotificacion },
      { reintentos, estado: agotada ? EstadoNotificacion.FALLIDA : EstadoNotificacion.PENDIENTE },
    );
    this.logger.warn(
      `Notificación ${notificacion.idNotificacion} falló (intento ${reintentos}/${MAX_REINTENTOS}): ${resultado.error}`,
    );
  }
}
