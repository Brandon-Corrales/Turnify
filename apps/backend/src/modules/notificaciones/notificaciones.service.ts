import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { Between, EntityManager, In, Repository } from 'typeorm';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import {
  CanalNotificacion,
  CanalPreferido,
  Cliente,
  EstadoNotificacion,
  EstadoReserva,
  Notificacion,
  Reserva,
  Servicio,
  TipoNotificacion,
} from '../../database/entities';
import { formatearFechaHoraLocalCR } from '../../common/utils/zona-horaria-negocio';
import { construirMensaje, type TipoMensajeReserva } from './mensajes-notificacion';
import { ResendService, type ResultadoEnvio } from './providers/resend.service';
import { WhatsappCloudApiService } from './providers/whatsapp-cloud-api.service';
import { esAnuladaPorReprogramacion, MotivoFallo, motivoPublico } from './motivo-fallo';

/** Después de este número de reintentos fallidos, la notificación se marca FALLIDA en vez de reintentar por siempre. */
const MAX_REINTENTOS = 3;

/** Máximo de notificaciones que envía una corrida del worker. */
const TAMANO_LOTE = 50;

/** Con cuánta anticipación se programa el recordatorio antes de la hora de la cita. */
const HORAS_ANTES_RECORDATORIO = 24;

const CANAL_POR_PREFERENCIA: Record<CanalPreferido, CanalNotificacion> = {
  [CanalPreferido.EMAIL]: CanalNotificacion.EMAIL,
  [CanalPreferido.WHATSAPP]: CanalNotificacion.WHATSAPP,
};

export type ResultadoProgramar = 'creada' | 'reactivada' | 'existente';

/**
 * Un solo INSERT atómico contra el índice único
 * `UQ_notificaciones_reserva_tipo_fecha`. Si la clave ya existe no inserta
 * nada y RETURNING devuelve cero filas.
 */
export const SQL_INSERTAR_IDEMPOTENTE = `
  INSERT INTO "notificaciones"
    ("id_reserva", "id_cliente", "tipo", "canal", "estado", "programado_para", "mensaje", "reintentos", "fecha_hora_reserva")
  VALUES ($1, $2, $3, $4, 'pendiente', $5, $6, 0, $7)
  ON CONFLICT ("id_reserva", "tipo", "fecha_hora_reserva") DO NOTHING
  RETURNING "id_notificacion"`;

/**
 * Toma la siguiente notificación pendiente con bloqueo de fila. `SKIP LOCKED`
 * salta las que otra transacción (otra instancia) ya tiene tomadas, en vez de
 * esperar a que termine; es el uso que documenta PostgreSQL para tablas tipo
 * cola con varios consumidores (sección "The Locking Clause" de SELECT).
 */
export const SQL_TOMAR_SIGUIENTE_PENDIENTE = `
  SELECT "id_notificacion" FROM "notificaciones"
  WHERE "estado" = 'pendiente'
    AND "programado_para" <= $2
    AND NOT ("id_notificacion" = ANY($1::uuid[]))
  ORDER BY "programado_para" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED`;

/**
 * Si la clave ya existía porque se ANULÓ por una reprogramación (la reserva
 * se movió y después volvió a esta misma hora), esa fila vuelve a quedar
 * pendiente con el mensaje recién generado, en vez de insertar otra (el
 * índice único no lo permitiría) o de quedarse sin aviso. Atómica: solo la
 * toma quien la encuentra todavía anulada.
 */
export const SQL_REACTIVAR_ANULADA = `
  UPDATE "notificaciones"
  SET "estado" = 'pendiente', "ultimo_error" = NULL, "reintentos" = 0,
      "programado_para" = $4, "mensaje" = $5, "canal" = $6, "actualizado_en" = now()
  WHERE "id_reserva" = $1 AND "tipo" = $2 AND "fecha_hora_reserva" = $3
    AND "estado" = 'fallida' AND "ultimo_error" = '${MotivoFallo.REPROGRAMADA}'
  RETURNING "id_notificacion"`;

/**
 * Al reprogramar: los avisos de la reserva que siguen pendientes con OTRA
 * hora (recordatorio o aviso de una reprogramación anterior) llevan una hora
 * que ya no es la de la cita. Se anulan sin borrarlos: quedan FALLIDA con
 * motivo REPROGRAMADA (no hay un estado "anulada"), y el worker solo toma
 * PENDIENTE, así que no se envían ni se reintentan.
 */
export const SQL_ANULAR_AVISOS_HORA_ANTERIOR = `
  UPDATE "notificaciones"
  SET "estado" = 'fallida', "ultimo_error" = '${MotivoFallo.REPROGRAMADA}', "actualizado_en" = now()
  WHERE "id_reserva" = $1 AND "estado" = 'pendiente'
    AND "tipo" IN ('${TipoNotificacion.RECORDATORIO}', '${TipoNotificacion.REPROGRAMACION}')
    AND "fecha_hora_reserva" <> $2
  RETURNING "id_notificacion"`;

/** TypeORM devuelve `[filas, cantidad]` para UPDATE y solo `filas` para el resto. */
function filasDe<T>(resultado: unknown): T[] {
  const r = resultado as unknown[];
  return Array.isArray(r[0]) ? (r[0] as T[]) : (r as T[]);
}

/** Clave de un envío único, como texto, para comparar en memoria. */
function claveEnvio(idReserva: string, fechaHoraReserva: Date): string {
  return `${idReserva}|${new Date(fechaHoraReserva).getTime()}`;
}

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
  /** Evitan que una corrida lenta del cron se solape con la siguiente en esta misma instancia. */
  private procesandoPendientes = false;
  private programandoRecordatorios = false;

  constructor(
    @InjectRepository(Notificacion) private readonly notificacionRepo: Repository<Notificacion>,
    @InjectRepository(Reserva) private readonly reservaRepo: Repository<Reserva>,
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

  /**
   * Punto 4.3: avisa al cliente la hora nueva y anula los avisos pendientes
   * que tenían la hora anterior. El recordatorio de la hora nueva lo crea el
   * cron cuando falten menos de 24 h, como para cualquier reserva (la clave
   * incluye la hora, así que no choca con el de la hora anterior).
   */
  async programarReprogramacion(
    reserva: Reserva,
    cliente: Cliente,
    servicio: Servicio,
  ): Promise<void> {
    const anuladas = filasDe<{ id_notificacion: string }>(
      await this.notificacionRepo.query(SQL_ANULAR_AVISOS_HORA_ANTERIOR, [
        reserva.idReserva,
        reserva.fechaHoraInicio,
      ]),
    );
    if (anuladas.length > 0) {
      this.logger.log(
        `Reserva ${reserva.idReserva} reprogramada: ${anuladas.length} aviso(s) pendiente(s) con la hora anterior anulado(s)`,
      );
    }
    await this.programar(TipoNotificacion.REPROGRAMACION, reserva, cliente, servicio);
  }

  /**
   * Inserción idempotente (punto 4.1 del Bloque 4). Antes era "buscar si
   * existe y luego INSERT", dos sentencias separadas: dos procesos con el
   * mismo cron (Render y los backends locales del equipo, todos contra la
   * misma base) pasaban el chequeo a la vez y ambos insertaban. Ahora es una
   * sola sentencia contra el índice único
   * (id_reserva, tipo, fecha_hora_reserva): si la clave ya existe, PostgreSQL
   * no inserta nada y no hay ventana de carrera.
   */
  private async programar(
    tipo: TipoMensajeReserva,
    reserva: Reserva,
    cliente: Cliente,
    servicio: Servicio,
  ): Promise<ResultadoProgramar> {
    const { asunto, texto } = construirMensaje(this.i18n, tipo, cliente.idiomaPreferido, {
      nombreServicio: servicio.nombre,
      fechaHoraTexto: formatearFechaHoraLocalCR(reserva.fechaHoraInicio, cliente.idiomaPreferido),
    });
    // El asunto (solo relevante para email) viaja como primera línea del
    // mensaje — el ER no tiene una columna separada para asunto y no vale la
    // pena una migración solo por eso.
    const mensaje = `${asunto}\n${texto}`;
    const canal = CANAL_POR_PREFERENCIA[cliente.canalPreferido];
    const ahora = new Date();
    const insertadas: Array<{ id_notificacion: string }> = await this.notificacionRepo.query(
      SQL_INSERTAR_IDEMPOTENTE,
      [reserva.idReserva, cliente.idCliente, tipo, canal, ahora, mensaje, reserva.fechaHoraInicio],
    );
    if (insertadas.length > 0) {
      this.logger.log(`Notificación ${tipo} programada para cliente ${cliente.idCliente}`);
      return 'creada';
    }
    const reactivadas = filasDe<{ id_notificacion: string }>(
      await this.notificacionRepo.query(SQL_REACTIVAR_ANULADA, [
        reserva.idReserva,
        tipo,
        reserva.fechaHoraInicio,
        ahora,
        mensaje,
        canal,
      ]),
    );
    if (reactivadas.length > 0) {
      this.logger.log(
        `Notificación ${tipo} de la reserva ${reserva.idReserva} reactivada: la cita volvió a esa hora`,
      );
      return 'reactivada';
    }
    this.logger.log(
      `Notificación ${tipo} de la reserva ${reserva.idReserva} ya existía para esa hora; no se duplica`,
    );
    return 'existente';
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
    // Whitelist al leer: aunque la columna tuviera un valor viejo o
    // inesperado, por la API solo sale un código conocido.
    for (const n of data) n.ultimoError = motivoPublico(n.ultimoError);
    return { data, total, page, limit };
  }

  /**
   * Worker de envío (punto 4.2 del Bloque 4: seguro con varias instancias).
   *
   * - Dentro de la instancia: si la corrida anterior todavía no terminó (un
   *   proveedor lento), esta se salta en vez de solaparse.
   * - Entre instancias: cada notificación se toma con
   *   `SELECT ... FOR UPDATE SKIP LOCKED` en su propia transacción, que dura
   *   lo que dura su envío. Otra instancia que corre a la vez se salta esa
   *   fila y toma la siguiente, así que ninguna se envía dos veces. Al
   *   confirmar, la fila ya no está `pendiente` (o, si falló, la retoma una
   *   corrida posterior). Si el proceso muere a mitad de un envío, la
   *   transacción se revierte y la fila vuelve a quedar pendiente: entrega
   *   "al menos una vez", nunca "se perdió".
   * - `intentadas` evita retomar en la MISMA corrida una fila que acaba de
   *   fallar y sigue pendiente (reintenta en la corrida siguiente, como antes).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarPendientes(): Promise<void> {
    if (this.procesandoPendientes) {
      this.logger.warn(
        'La corrida anterior de envío de notificaciones sigue activa; se salta esta',
      );
      return;
    }
    this.procesandoPendientes = true;
    try {
      const intentadas: string[] = [];
      for (let i = 0; i < TAMANO_LOTE; i++) {
        let tomada: string | null;
        try {
          tomada = await this.notificacionRepo.manager.transaction((manager) =>
            this.tomarYEnviarSiguiente(manager, intentadas),
          );
        } catch (error) {
          // Error de la base (no del proveedor): se corta esta corrida y la
          // siguiente vuelve a intentar.
          this.logger.error(`Corrida de envío interrumpida: ${(error as Error).message}`);
          return;
        }
        if (!tomada) return;
        intentadas.push(tomada);
      }
    } finally {
      this.procesandoPendientes = false;
    }
  }

  /** Toma (con bloqueo de fila) la siguiente pendiente y la envía. Devuelve su id, o null si no queda ninguna libre. */
  private async tomarYEnviarSiguiente(
    manager: EntityManager,
    intentadas: string[],
  ): Promise<string | null> {
    const filas: Array<{ id_notificacion: string }> = await manager.query(
      SQL_TOMAR_SIGUIENTE_PENDIENTE,
      [intentadas, new Date()],
    );
    if (filas.length === 0) return null;
    const idNotificacion = filas[0].id_notificacion;
    const repo = manager.getRepository(Notificacion);
    try {
      const notificacion = await repo.findOne({
        where: { idNotificacion },
        relations: { cliente: true },
        // El cliente puede haberse desactivado (soft-delete) DESPUÉS de
        // programar la notificación — sin esto TypeORM lo excluye del join
        // y notificacion.cliente llega null, reventando enviarUna() (bug
        // real, mismo patrón ya encontrado y arreglado en
        // ReservasService.listar()/obtenerUna(): el historial no debe
        // romperse porque un cliente se desactivó después).
        withDeleted: true,
      });
      if (!notificacion) throw new Error('la fila tomada ya no existe');
      await this.enviarUna(notificacion, repo);
    } catch (error) {
      // Una notificación con datos irrecuperables (p.ej. el cliente ya no
      // existe ni con withDeleted) nunca debe bloquear el resto del lote.
      this.logger.error(
        `Notificación ${idNotificacion} no se pudo procesar: ${(error as Error).message}`,
      );
      await repo.update({ idNotificacion }, { estado: EstadoNotificacion.FALLIDA });
    }
    return idNotificacion;
  }

  /**
   * Cron de RECORDATORIO
   * Corre cada 10 minutos y programa el recordatorio de toda reserva
   * confirmada cuya hora de inicio cae dentro de las próximas
   * `HORAS_ANTES_RECORDATORIO` horas. Una reserva que YA tiene un
   * recordatorio para su hora actual se descarta, sin importar su estado
   * (incluso uno que falló cuenta como "intentado", para no reencolarlo en
   * cada corrida). Ese filtro solo ahorra trabajo: la garantía real de no
   * duplicar, incluso con varias instancias a la vez, es el INSERT
   * idempotente de `programar()`.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async programarRecordatorios(): Promise<void> {
    if (this.programandoRecordatorios) {
      this.logger.warn('La corrida anterior de recordatorios sigue activa; se salta esta');
      return;
    }
    this.programandoRecordatorios = true;
    try {
      await this.programarRecordatoriosProximos();
    } finally {
      this.programandoRecordatorios = false;
    }
  }

  private async programarRecordatoriosProximos(): Promise<void> {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + HORAS_ANTES_RECORDATORIO * 60 * 60 * 1000);

    const proximas = await this.reservaRepo.find({
      where: { estado: EstadoReserva.CONFIRMADA, fechaHoraInicio: Between(ahora, limite) },
      relations: { cliente: true, servicio: true },
    });
    if (proximas.length === 0) return;

    const yaProgramadas = await this.notificacionRepo.find({
      where: {
        idReserva: In(proximas.map((r) => r.idReserva)),
        tipo: TipoNotificacion.RECORDATORIO,
      },
    });
    // Las anuladas por una reprogramación no cuentan: si la cita volvió a
    // esa hora, programar() las reactiva.
    const clavesYaProgramadas = new Set(
      yaProgramadas
        .filter((n) => !esAnuladaPorReprogramacion(n.estado, n.ultimoError))
        .map((n) => claveEnvio(n.idReserva, n.fechaHoraReserva)),
    );

    for (const reserva of proximas) {
      if (clavesYaProgramadas.has(claveEnvio(reserva.idReserva, reserva.fechaHoraInicio))) continue;
      await this.programar(
        TipoNotificacion.RECORDATORIO,
        reserva,
        reserva.cliente,
        reserva.servicio,
      );
    }
  }

  private async enviarUna(
    notificacion: Notificacion,
    repo: Repository<Notificacion>,
  ): Promise<void> {
    const [asunto, ...resto] = notificacion.mensaje.split('\n');
    const texto = resto.join('\n');
    const cliente = notificacion.cliente;

    const resultado: ResultadoEnvio =
      notificacion.canal === CanalNotificacion.EMAIL
        ? await this.resend.enviarCorreo(cliente.correoElectronico, asunto, texto)
        : notificacion.canal === CanalNotificacion.WHATSAPP
          ? await this.whatsapp.enviarMensaje(cliente.telefono ?? '', texto)
          : {
              exito: false,
              error: `Canal ${notificacion.canal} no tiene proveedor implementado`,
              motivo: MotivoFallo.CANAL_SIN_PROVEEDOR,
            };

    if (resultado.exito) {
      await repo.update(
        { idNotificacion: notificacion.idNotificacion },
        {
          estado: EstadoNotificacion.ENVIADA,
          enviadoEn: new Date(),
          ultimoError: null,
          // Solo Resend lo devuelve hoy; lo usa el webhook de Resend.
          idCorreoProveedor: resultado.idProveedor ?? null,
        },
      );
      this.logger.log(
        `Notificación ${notificacion.idNotificacion} enviada por ${notificacion.canal}`,
      );
      return;
    }

    const reintentos = notificacion.reintentos + 1;
    const agotada = reintentos >= MAX_REINTENTOS;
    await repo.update(
      { idNotificacion: notificacion.idNotificacion },
      {
        reintentos,
        estado: agotada ? EstadoNotificacion.FALLIDA : EstadoNotificacion.PENDIENTE,
        // Solo la categoría saneada (ver motivo-fallo.ts). El texto crudo del
        // proveedor puede traer datos de terceros y queda únicamente en el
        // log de abajo.
        ultimoError: resultado.motivo ?? MotivoFallo.RECHAZADO_POR_PROVEEDOR,
      },
    );
    this.logger.warn(
      `Notificación ${notificacion.idNotificacion} falló (intento ${reintentos}/${MAX_REINTENTOS}): ${resultado.error}`,
    );
  }
}
