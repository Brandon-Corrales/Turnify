import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificacionesService,
  SQL_INSERTAR_IDEMPOTENTE,
  SQL_TOMAR_SIGUIENTE_PENDIENTE,
} from './notificaciones.service';
import {
  CanalNotificacion,
  CanalPreferido,
  EstadoNotificacion,
  EstadoReserva,
  Idioma,
  TipoNotificacion,
} from '../../database/entities';

interface FilaNotificacionFalsa {
  idNotificacion: string;
  idReserva: string;
  idCliente: string;
  tipo: TipoNotificacion;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  programadoPara: Date;
  mensaje: string;
  reintentos: number;
  fechaHoraReserva: Date;
  ultimoError: string | null;
  cliente?: unknown;
  [otro: string]: unknown;
}

/**
 * Tabla `notificaciones` en memoria que responde a las sentencias SQL del
 * servicio. Cada llamada a `query` es atómica (JavaScript no la interrumpe),
 * igual que una sentencia en PostgreSQL, y el INSERT respeta el índice único
 * (id_reserva, tipo, fecha_hora_reserva). Antes de responder cede el turno
 * con `await`, como un viaje real a la base, para que las llamadas
 * concurrentes se intercalen.
 */
function crearTablaNotificacionesFalsa() {
  const filas: FilaNotificacionFalsa[] = [];
  let secuencia = 0;
  const mismaClave = (
    f: FilaNotificacionFalsa,
    idReserva: unknown,
    tipo: unknown,
    fecha: unknown,
  ) =>
    f.idReserva === idReserva &&
    f.tipo === tipo &&
    f.fechaHoraReserva.getTime() === new Date(fecha as Date).getTime();

  async function query(sql: string, params: unknown[] = []): Promise<unknown> {
    await Promise.resolve();
    if (sql.includes('INSERT INTO "notificaciones"')) {
      const [idReserva, idCliente, tipo, canal, programadoPara, mensaje, fechaHoraReserva] = params;
      if (filas.some((f) => mismaClave(f, idReserva, tipo, fechaHoraReserva))) return [];
      const fila: FilaNotificacionFalsa = {
        idNotificacion: `notif-${++secuencia}`,
        idReserva: idReserva as string,
        idCliente: idCliente as string,
        tipo: tipo as TipoNotificacion,
        canal: canal as CanalNotificacion,
        estado: EstadoNotificacion.PENDIENTE,
        programadoPara: programadoPara as Date,
        mensaje: mensaje as string,
        reintentos: 0,
        fechaHoraReserva: new Date(fechaHoraReserva as Date),
        ultimoError: null,
      };
      filas.push(fila);
      return [{ id_notificacion: fila.idNotificacion }];
    }
    if (sql.includes('SET "estado" = \'pendiente\'')) {
      // SQL_REACTIVAR_ANULADA. TypeORM devuelve [filas, cantidad] en UPDATE.
      const [idReserva, tipo, fecha, programadoPara, mensaje, canal] = params;
      const fila = filas.find(
        (f) =>
          mismaClave(f, idReserva, tipo, fecha) &&
          f.estado === EstadoNotificacion.FALLIDA &&
          f.ultimoError === 'REPROGRAMADA',
      );
      if (!fila) return [[], 0];
      Object.assign(fila, {
        estado: EstadoNotificacion.PENDIENTE,
        ultimoError: null,
        reintentos: 0,
        programadoPara,
        mensaje,
        canal,
      });
      return [[{ id_notificacion: fila.idNotificacion }], 1];
    }
    if (sql.includes('"ultimo_error" = \'CANCELADA\'')) {
      // SQL_ANULAR_AVISOS_POR_CANCELACION
      const [idReserva] = params;
      const afectadas = filas.filter(
        (f) =>
          f.idReserva === idReserva &&
          f.estado === EstadoNotificacion.PENDIENTE &&
          [TipoNotificacion.RECORDATORIO, TipoNotificacion.REPROGRAMACION].includes(f.tipo),
      );
      for (const f of afectadas)
        Object.assign(f, { estado: EstadoNotificacion.FALLIDA, ultimoError: 'CANCELADA' });
      return [afectadas.map((f) => ({ id_notificacion: f.idNotificacion })), afectadas.length];
    }
    if (sql.includes('SET "estado" = \'fallida\'')) {
      // SQL_ANULAR_AVISOS_HORA_ANTERIOR
      const [idReserva, fechaNueva] = params;
      const afectadas = filas.filter(
        (f) =>
          f.idReserva === idReserva &&
          f.estado === EstadoNotificacion.PENDIENTE &&
          [TipoNotificacion.RECORDATORIO, TipoNotificacion.REPROGRAMACION].includes(f.tipo) &&
          f.fechaHoraReserva.getTime() !== new Date(fechaNueva as Date).getTime(),
      );
      for (const f of afectadas)
        Object.assign(f, { estado: EstadoNotificacion.FALLIDA, ultimoError: 'REPROGRAMADA' });
      return [afectadas.map((f) => ({ id_notificacion: f.idNotificacion })), afectadas.length];
    }
    throw new Error(`SQL no simulado en la tabla falsa: ${sql}`);
  }

  /** Filas bloqueadas por alguna transacción abierta (FOR UPDATE). */
  const bloqueadas = new Set<string>();

  /** `SELECT ... FOR UPDATE SKIP LOCKED`: salta las filas que tiene otra transacción. */
  function tomarSiguiente(params: unknown[], propias: Set<string>) {
    const [excluidas, ahora] = params as [string[], Date];
    const libre = filas
      .filter(
        (f) =>
          f.estado === EstadoNotificacion.PENDIENTE &&
          f.programadoPara.getTime() <= ahora.getTime() &&
          !excluidas.includes(f.idNotificacion) &&
          !bloqueadas.has(f.idNotificacion),
      )
      .sort((a, b) => a.programadoPara.getTime() - b.programadoPara.getTime())[0];
    if (!libre) return [];
    bloqueadas.add(libre.idNotificacion);
    propias.add(libre.idNotificacion);
    return [{ id_notificacion: libre.idNotificacion }];
  }

  /** Simula `manager.transaction()`: los bloqueos se liberan al terminar (commit o rollback). */
  function crearTransaction(repo: unknown) {
    return async <T>(cb: (manager: unknown) => Promise<T>): Promise<T> => {
      const propias = new Set<string>();
      const manager = {
        query: async (sql: string, params: unknown[] = []) => {
          await Promise.resolve();
          return sql.includes('FOR UPDATE SKIP LOCKED')
            ? tomarSiguiente(params, propias)
            : query(sql, params);
        },
        getRepository: () => repo,
      };
      try {
        return await cb(manager);
      } finally {
        for (const id of propias) bloqueadas.delete(id);
      }
    };
  }

  /** Agrega filas pendientes ya vencidas (listas para enviarse). */
  function agregarPendientes(parciales: Array<Partial<FilaNotificacionFalsa>>) {
    for (const p of parciales) {
      filas.push({
        idNotificacion: `notif-${++secuencia}`,
        idReserva: `reserva-${secuencia}`,
        idCliente: 'cliente-1',
        tipo: TipoNotificacion.CONFIRMACION,
        canal: CanalNotificacion.EMAIL,
        estado: EstadoNotificacion.PENDIENTE,
        programadoPara: new Date(Date.now() - 60_000),
        mensaje: 'Asunto\nCuerpo',
        reintentos: 0,
        fechaHoraReserva: new Date('2027-03-01T16:00:00.000Z'),
        ultimoError: null,
        ...p,
      });
    }
  }

  return { filas, query, mismaClave, crearTransaction, agregarPendientes };
}

function crearNotificacionRepoMock(tabla = crearTablaNotificacionesFalsa()) {
  const queryBuilder: any = {
    innerJoin: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  const repo = {
    find: vi.fn().mockResolvedValue([]),
    update: vi.fn(async (where: { idNotificacion: string }, cambios: object) => {
      await Promise.resolve();
      const fila = tabla.filas.find((f) => f.idNotificacion === where.idNotificacion);
      if (fila) Object.assign(fila, cambios);
    }),
    findOne: vi.fn(async ({ where }: { where: { idNotificacion: string } }) => {
      await Promise.resolve();
      const fila = tabla.filas.find((f) => f.idNotificacion === where.idNotificacion);
      // Como el join con `cliente`: las filas insertadas por SQL no lo traen.
      return fila ? { cliente: CLIENTES_POR_ID[fila.idCliente], ...fila } : null;
    }),
    createQueryBuilder: vi.fn(() => queryBuilder),
    query: vi.fn(tabla.query),
    manager: { transaction: vi.fn() },
    _queryBuilder: queryBuilder,
    _tabla: tabla,
  };
  repo.manager.transaction.mockImplementation(tabla.crearTransaction(repo));
  return repo;
}

function crearReservaRepoMock() {
  return { find: vi.fn().mockResolvedValue([]) };
}

function crearProviderMock() {
  return { enviarCorreo: vi.fn(), enviarMensaje: vi.fn() };
}

/** Simula lo suficiente de I18nService.translate() para probar interpolación y selección de idioma, sin cargar archivos reales. */
function crearI18nMock() {
  const textos: Record<string, Record<string, string>> = {
    'notificaciones.CONFIRMACION_ASUNTO': { es: 'Reserva confirmada', en: 'Booking confirmed' },
    'notificaciones.CONFIRMACION_TEXTO': {
      es: 'Tu reserva de "{nombreServicio}" para el {fechaHoraTexto} quedó confirmada.',
      en: 'Your "{nombreServicio}" appointment on {fechaHoraTexto} has been confirmed.',
    },
    'notificaciones.CANCELACION_ASUNTO': { es: 'Reserva cancelada', en: 'Booking cancelled' },
    'notificaciones.CANCELACION_TEXTO': {
      es: 'Tu reserva de "{nombreServicio}" para el {fechaHoraTexto} fue cancelada.',
      en: 'Your "{nombreServicio}" appointment on {fechaHoraTexto} has been cancelled.',
    },
    'notificaciones.RECORDATORIO_ASUNTO': {
      es: 'Recordatorio de tu cita',
      en: 'Appointment reminder',
    },
    'notificaciones.REPROGRAMACION_ASUNTO': {
      es: 'Reserva reprogramada',
      en: 'Booking rescheduled',
    },
    'notificaciones.REPROGRAMACION_TEXTO': {
      es: 'Tu reserva de "{nombreServicio}" se reprogramó para el {fechaHoraTexto}.',
      en: 'Your "{nombreServicio}" appointment has been rescheduled to {fechaHoraTexto}.',
    },
    'notificaciones.RECORDATORIO_TEXTO': {
      es: 'Te recordamos tu reserva de "{nombreServicio}" para el {fechaHoraTexto}.',
      en: 'This is a reminder of your "{nombreServicio}" appointment on {fechaHoraTexto}.',
    },
  };
  return {
    translate: vi.fn((clave: string, opts: { lang: string; args?: Record<string, string> }) => {
      let texto = textos[clave]?.[opts.lang] ?? clave;
      for (const [k, v] of Object.entries(opts.args ?? {})) texto = texto.replace(`{${k}}`, v);
      return texto;
    }),
  };
}

const CLIENTE_EMAIL = {
  idCliente: 'cliente-1',
  correoElectronico: 'cliente@example.com',
  telefono: '+50688880000',
  canalPreferido: CanalPreferido.EMAIL,
  idiomaPreferido: Idioma.ES,
};

/** Clientes que resuelve el join de la tabla falsa. */
const CLIENTES_POR_ID: Record<string, unknown> = { 'cliente-1': CLIENTE_EMAIL };

const RESERVA = {
  idReserva: 'reserva-1',
  fechaHoraInicio: new Date('2027-03-01T16:00:00.000Z'),
};

const SERVICIO = { idServicio: 'servicio-1', nombre: 'Corte de cabello' };

describe('NotificacionesService', () => {
  let notificacionRepo: ReturnType<typeof crearNotificacionRepoMock>;
  let reservaRepo: ReturnType<typeof crearReservaRepoMock>;
  let resend: ReturnType<typeof crearProviderMock>;
  let whatsapp: ReturnType<typeof crearProviderMock>;
  let i18n: ReturnType<typeof crearI18nMock>;
  let service: NotificacionesService;

  beforeEach(() => {
    notificacionRepo = crearNotificacionRepoMock();
    reservaRepo = crearReservaRepoMock();
    resend = crearProviderMock();
    whatsapp = crearProviderMock();
    i18n = crearI18nMock();
    service = new NotificacionesService(
      notificacionRepo as any,
      reservaRepo as any,
      resend as any,
      whatsapp as any,
      i18n as any,
    );
  });

  it('programarConfirmacion() crea una notificación pendiente con el canal preferido del cliente', async () => {
    await service.programarConfirmacion(RESERVA as any, CLIENTE_EMAIL as any, SERVICIO as any);
    expect(notificacionRepo._tabla.filas).toEqual([
      expect.objectContaining({
        idReserva: 'reserva-1',
        idCliente: 'cliente-1',
        tipo: TipoNotificacion.CONFIRMACION,
        canal: CanalNotificacion.EMAIL,
        estado: EstadoNotificacion.PENDIENTE,
        reintentos: 0,
        fechaHoraReserva: RESERVA.fechaHoraInicio,
      }),
    ]);
  });

  it('programarConfirmacion() genera el mensaje en inglés si el cliente prefiere inglés', async () => {
    await service.programarConfirmacion(
      RESERVA as any,
      { ...CLIENTE_EMAIL, idiomaPreferido: Idioma.EN } as any,
      SERVICIO as any,
    );
    const guardado = notificacionRepo._tabla.filas[0];
    expect(guardado.mensaje).toContain('Booking confirmed');
    expect(guardado.mensaje).toContain('confirmed');
  });

  it('procesarPendientes() envía por Resend cuando el canal es email y marca ENVIADA', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-1',
        canal: CanalNotificacion.EMAIL,
        mensaje: 'Asunto\nCuerpo del mensaje',
        reintentos: 0,
        cliente: CLIENTE_EMAIL,
      },
    ]);
    resend.enviarCorreo.mockResolvedValue({ exito: true });

    await service.procesarPendientes();

    expect(resend.enviarCorreo).toHaveBeenCalledWith(
      'cliente@example.com',
      'Asunto',
      'Cuerpo del mensaje',
    );
    expect(notificacionRepo.update).toHaveBeenCalledWith(
      { idNotificacion: 'notif-1' },
      expect.objectContaining({ estado: EstadoNotificacion.ENVIADA, ultimoError: null }),
    );
  });

  it('procesarPendientes() envía por WhatsApp Cloud API cuando el canal es whatsapp', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-2',
        canal: CanalNotificacion.WHATSAPP,
        mensaje: 'Asunto\nCuerpo',
        reintentos: 0,
        cliente: { ...CLIENTE_EMAIL, canalPreferido: CanalPreferido.WHATSAPP },
      },
    ]);
    whatsapp.enviarMensaje.mockResolvedValue({ exito: true });

    await service.procesarPendientes();

    expect(whatsapp.enviarMensaje).toHaveBeenCalledWith('+50688880000', 'Cuerpo');
    expect(resend.enviarCorreo).not.toHaveBeenCalled();
  });

  it('procesarPendientes() reintenta (sigue PENDIENTE) mientras no se agoten los reintentos', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-3',
        canal: CanalNotificacion.EMAIL,
        mensaje: 'Asunto\nCuerpo',
        reintentos: 0,
        cliente: CLIENTE_EMAIL,
      },
    ]);
    resend.enviarCorreo.mockResolvedValue({ exito: false, error: 'timeout' });

    await service.procesarPendientes();

    expect(notificacionRepo.update).toHaveBeenCalledWith(
      { idNotificacion: 'notif-3' },
      {
        reintentos: 1,
        estado: EstadoNotificacion.PENDIENTE,
        ultimoError: 'RECHAZADO_POR_PROVEEDOR',
      },
    );
  });

  it('procesarPendientes() guarda solo la categoría saneada, nunca el texto crudo del proveedor', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-crudo',
        canal: CanalNotificacion.EMAIL,
        mensaje: ['Asunto', 'Cuerpo'].join(String.fromCharCode(10)),
        reintentos: 0,
        cliente: { correoElectronico: 'cliente@example.com' },
      },
    ]);
    resend.enviarCorreo.mockResolvedValue({
      exito: false,
      error: 'You can only send testing emails to your own email address (duena@cuenta.test).',
      motivo: 'DESTINATARIO_NO_HABILITADO',
    });
    await service.procesarPendientes();
    const cambios = (notificacionRepo.update as any).mock.calls[0][1];
    expect(cambios.ultimoError).toBe('DESTINATARIO_NO_HABILITADO');
    expect(JSON.stringify(cambios)).not.toContain('@');
  });

  it('procesarPendientes() marca FALLIDA al agotar los reintentos', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-4',
        canal: CanalNotificacion.EMAIL,
        mensaje: 'Asunto\nCuerpo',
        reintentos: 2, // el 3er intento fallido agota el máximo (3)
        cliente: CLIENTE_EMAIL,
      },
    ]);
    resend.enviarCorreo.mockResolvedValue({ exito: false, error: 'timeout' });

    await service.procesarPendientes();

    expect(notificacionRepo.update).toHaveBeenCalledWith(
      { idNotificacion: 'notif-4' },
      { reintentos: 3, estado: EstadoNotificacion.FALLIDA, ultimoError: 'RECHAZADO_POR_PROVEEDOR' },
    );
  });

  it('procesarPendientes() busca las pendientes con withDeleted (el cliente puede haberse desactivado después de programar la notificación)', async () => {
    notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
    resend.enviarCorreo.mockResolvedValue({ exito: true });
    await service.procesarPendientes();
    expect(notificacionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
  });

  it('procesarPendientes() — bug real corregido: una notificación con cliente irrecuperable se marca FALLIDA y NO bloquea el resto del lote', async () => {
    notificacionRepo._tabla.agregarPendientes([
      {
        idNotificacion: 'notif-envenenada',
        canal: CanalNotificacion.EMAIL,
        mensaje: 'Asunto\nCuerpo',
        reintentos: 0,
        cliente: null, // cliente ya no recuperable ni con withDeleted (p.ej. borrado físico)
      },
      {
        idNotificacion: 'notif-5',
        canal: CanalNotificacion.EMAIL,
        mensaje: 'Asunto\nCuerpo del mensaje',
        reintentos: 0,
        cliente: CLIENTE_EMAIL,
      },
    ]);
    resend.enviarCorreo.mockResolvedValue({ exito: true });

    await service.procesarPendientes();

    // Antes del fix, el TypeError al leer cliente.correoElectronico de la
    // primera notificación cortaba el `for` entero y notif-5 (real, con
    // cliente válido) nunca se procesaba.
    expect(notificacionRepo.update).toHaveBeenCalledWith(
      { idNotificacion: 'notif-envenenada' },
      { estado: EstadoNotificacion.FALLIDA },
    );
    expect(resend.enviarCorreo).toHaveBeenCalledWith(
      'cliente@example.com',
      'Asunto',
      'Cuerpo del mensaje',
    );
    expect(notificacionRepo.update).toHaveBeenCalledWith(
      { idNotificacion: 'notif-5' },
      expect.objectContaining({ estado: EstadoNotificacion.ENVIADA }),
    );
  });

  describe('varias instancias y solapamiento (Bloque 4, punto 4.2)', () => {
    const lento = (ms: number) => () =>
      new Promise((resolver) => setTimeout(() => resolver({ exito: true }), ms));

    it('dos instancias corriendo a la vez envían cada pendiente una sola vez', async () => {
      notificacionRepo._tabla.agregarPendientes(
        Array.from({ length: 8 }, () => ({ cliente: CLIENTE_EMAIL })),
      );
      resend.enviarCorreo.mockImplementation(lento(5));
      const otraInstancia = new NotificacionesService(
        crearNotificacionRepoMock(notificacionRepo._tabla) as any,
        reservaRepo as any,
        resend as any,
        whatsapp as any,
        i18n as any,
      );

      await Promise.all([service.procesarPendientes(), otraInstancia.procesarPendientes()]);

      expect(resend.enviarCorreo).toHaveBeenCalledTimes(8);
      expect(
        notificacionRepo._tabla.filas.every((f) => f.estado === EstadoNotificacion.ENVIADA),
      ).toBe(true);
    });

    it('las dos instancias reparten el trabajo (SKIP LOCKED salta la fila tomada en vez de esperar)', async () => {
      notificacionRepo._tabla.agregarPendientes(
        Array.from({ length: 6 }, () => ({ cliente: CLIENTE_EMAIL })),
      );
      resend.enviarCorreo.mockImplementation(lento(5));
      const repoOtra = crearNotificacionRepoMock(notificacionRepo._tabla);
      const otraInstancia = new NotificacionesService(
        repoOtra as any,
        reservaRepo as any,
        resend as any,
        whatsapp as any,
        i18n as any,
      );

      await Promise.all([service.procesarPendientes(), otraInstancia.procesarPendientes()]);

      const enviadasPor = (repo: typeof notificacionRepo) =>
        repo.update.mock.calls.filter(
          ([, cambios]: any) => cambios.estado === EstadoNotificacion.ENVIADA,
        ).length;
      expect(enviadasPor(notificacionRepo)).toBeGreaterThan(0);
      expect(enviadasPor(repoOtra)).toBeGreaterThan(0);
      expect(enviadasPor(notificacionRepo) + enviadasPor(repoOtra)).toBe(6);
    });

    it('una corrida lenta no se solapa con la siguiente en la misma instancia', async () => {
      notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
      resend.enviarCorreo.mockImplementation(lento(20));

      await Promise.all([service.procesarPendientes(), service.procesarPendientes()]);

      expect(resend.enviarCorreo).toHaveBeenCalledTimes(1);
      expect(notificacionRepo.manager.transaction).toHaveBeenCalledTimes(2); // la fila + "no queda ninguna"
    });

    it('al terminar la corrida libera el candado: la siguiente sí procesa', async () => {
      notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
      resend.enviarCorreo.mockResolvedValue({ exito: true });
      await service.procesarPendientes();
      notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
      await service.procesarPendientes();
      expect(resend.enviarCorreo).toHaveBeenCalledTimes(2);
    });

    it('una que falla y sigue pendiente no se reintenta en la MISMA corrida', async () => {
      notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
      resend.enviarCorreo.mockResolvedValue({ exito: false, error: 'timeout' });
      await service.procesarPendientes();
      expect(resend.enviarCorreo).toHaveBeenCalledTimes(1);
      expect(notificacionRepo._tabla.filas[0]).toMatchObject({
        estado: EstadoNotificacion.PENDIENTE,
        reintentos: 1,
      });
    });

    it('un error de la base corta la corrida sin dejar el candado tomado', async () => {
      notificacionRepo.manager.transaction.mockRejectedValueOnce(new Error('conexión perdida'));
      await service.procesarPendientes();
      notificacionRepo._tabla.agregarPendientes([{ cliente: CLIENTE_EMAIL }]);
      resend.enviarCorreo.mockResolvedValue({ exito: true });
      await service.procesarPendientes();
      expect(resend.enviarCorreo).toHaveBeenCalledTimes(1);
    });

    it('toma las pendientes con FOR UPDATE SKIP LOCKED', () => {
      expect(SQL_TOMAR_SIGUIENTE_PENDIENTE).toMatch(/FOR UPDATE SKIP LOCKED/);
      expect(SQL_TOMAR_SIGUIENTE_PENDIENTE).toMatch(/"estado" = 'pendiente'/);
    });

    it('el cron de recordatorios tampoco se solapa consigo mismo', async () => {
      let liberar!: (v: unknown) => void;
      reservaRepo.find.mockReturnValueOnce(new Promise((r) => (liberar = r)));
      const primera = service.programarRecordatorios();
      await service.programarRecordatorios(); // se salta: la primera sigue activa
      expect(reservaRepo.find).toHaveBeenCalledTimes(1);
      liberar([]);
      await primera;
      await service.programarRecordatorios();
      expect(reservaRepo.find).toHaveBeenCalledTimes(2);
    });
  });

  it('programarRecordatorios() programa un recordatorio para una reserva confirmada dentro de las próximas 24h', async () => {
    const reserva = {
      idReserva: 'reserva-2',
      estado: EstadoReserva.CONFIRMADA,
      fechaHoraInicio: new Date(Date.now() + 2 * 60 * 60 * 1000),
      cliente: CLIENTE_EMAIL,
      servicio: SERVICIO,
    };
    reservaRepo.find.mockResolvedValue([reserva]);
    notificacionRepo.find.mockResolvedValue([]);

    await service.programarRecordatorios();

    expect(notificacionRepo._tabla.filas).toEqual([
      expect.objectContaining({
        idReserva: 'reserva-2',
        idCliente: 'cliente-1',
        tipo: TipoNotificacion.RECORDATORIO,
        estado: EstadoNotificacion.PENDIENTE,
        fechaHoraReserva: reserva.fechaHoraInicio,
      }),
    ]);
  });

  it('programarRecordatorios() no duplica el recordatorio de una reserva que ya lo tiene programado', async () => {
    const reserva = {
      idReserva: 'reserva-3',
      estado: EstadoReserva.CONFIRMADA,
      fechaHoraInicio: new Date(Date.now() + 2 * 60 * 60 * 1000),
      cliente: CLIENTE_EMAIL,
      servicio: SERVICIO,
    };
    reservaRepo.find.mockResolvedValue([reserva]);
    notificacionRepo.find.mockResolvedValue([
      {
        idReserva: 'reserva-3',
        tipo: TipoNotificacion.RECORDATORIO,
        fechaHoraReserva: reserva.fechaHoraInicio,
      },
    ]);

    await service.programarRecordatorios();

    expect(notificacionRepo.query).not.toHaveBeenCalled();
  });

  describe('creación idempotente (Bloque 4, punto 4.1)', () => {
    const reservaProxima = () => ({
      idReserva: 'reserva-dup',
      estado: EstadoReserva.CONFIRMADA,
      fechaHoraInicio: new Date(Date.now() + 3 * 60 * 60 * 1000),
      cliente: CLIENTE_EMAIL,
      servicio: SERVICIO,
    });

    it('programar dos veces la misma confirmación deja una sola fila', async () => {
      await service.programarConfirmacion(RESERVA as any, CLIENTE_EMAIL as any, SERVICIO as any);
      await service.programarConfirmacion(RESERVA as any, CLIENTE_EMAIL as any, SERVICIO as any);
      expect(notificacionRepo._tabla.filas).toHaveLength(1);
    });

    it('la causa raíz: dos instancias con el cron a la misma hora pasan el chequeo previo a la vez y aun así queda un solo recordatorio', async () => {
      // Dos procesos (p. ej. Render y un backend local) contra la MISMA base:
      // ambos leen "no hay recordatorio" antes de que ninguno inserte. Con el
      // código anterior (find + save) esto creaba 2 filas, que es el patrón
      // de producción: pares creados con ~0,2 s de diferencia en el tick.
      const reserva = reservaProxima();
      const otraInstanciaRepo = crearNotificacionRepoMock(notificacionRepo._tabla);
      const otraInstancia = new NotificacionesService(
        otraInstanciaRepo as any,
        { find: vi.fn().mockResolvedValue([reserva]) } as any,
        resend as any,
        whatsapp as any,
        i18n as any,
      );
      reservaRepo.find.mockResolvedValue([reserva]);

      await Promise.all([service.programarRecordatorios(), otraInstancia.programarRecordatorios()]);

      expect(notificacionRepo.find).toHaveBeenCalled();
      expect(otraInstanciaRepo.find).toHaveBeenCalled();
      expect(notificacionRepo._tabla.filas).toHaveLength(1);
    });

    it('diez programaciones concurrentes del mismo recordatorio dejan una sola fila', async () => {
      const reserva = reservaProxima();
      reservaRepo.find.mockResolvedValue([reserva]);
      await Promise.all(Array.from({ length: 10 }, () => service.programarRecordatorios()));
      expect(notificacionRepo._tabla.filas).toHaveLength(1);
    });

    it('la misma reserva con OTRA hora (reprogramada) sí recibe un recordatorio nuevo', async () => {
      const reserva = reservaProxima();
      const horaAnterior = new Date(reserva.fechaHoraInicio.getTime() + 60 * 60 * 1000);
      reservaRepo.find.mockResolvedValue([reserva]);
      notificacionRepo.find.mockResolvedValue([
        {
          idReserva: reserva.idReserva,
          tipo: TipoNotificacion.RECORDATORIO,
          fechaHoraReserva: horaAnterior,
        },
      ]);

      await service.programarRecordatorios();

      expect(notificacionRepo._tabla.filas).toEqual([
        expect.objectContaining({ fechaHoraReserva: reserva.fechaHoraInicio }),
      ]);
    });

    it('confirmación y recordatorio de la misma reserva son envíos distintos', async () => {
      await service.programarConfirmacion(RESERVA as any, CLIENTE_EMAIL as any, SERVICIO as any);
      reservaRepo.find.mockResolvedValue([
        {
          ...RESERVA,
          estado: EstadoReserva.CONFIRMADA,
          cliente: CLIENTE_EMAIL,
          servicio: SERVICIO,
        },
      ]);
      await service.programarRecordatorios();
      expect(notificacionRepo._tabla.filas.map((f) => f.tipo).sort()).toEqual([
        TipoNotificacion.CONFIRMACION,
        TipoNotificacion.RECORDATORIO,
      ]);
    });

    it('el INSERT usa ON CONFLICT sobre la clave (id_reserva, tipo, fecha_hora_reserva)', () => {
      expect(SQL_INSERTAR_IDEMPOTENTE).toMatch(
        /ON CONFLICT \("id_reserva", "tipo", "fecha_hora_reserva"\) DO NOTHING/,
      );
    });
  });

  it('programarRecordatorios() no consulta notificaciones existentes si no hay reservas próximas (evita un query vacío)', async () => {
    reservaRepo.find.mockResolvedValue([]);

    await service.programarRecordatorios();

    expect(notificacionRepo.find).not.toHaveBeenCalled();
  });

  it('listar() filtra por el negocio actual vía join con Cliente y pagina el resultado', async () => {
    const filas = [{ idNotificacion: 'notif-1' }];
    notificacionRepo._queryBuilder.getManyAndCount.mockResolvedValue([filas, 1]);

    const resultado = await service.listar('negocio-1', { page: 1, limit: 20 });

    expect(notificacionRepo._queryBuilder.where).toHaveBeenCalledWith(
      'cliente.idNegocio = :idNegocio',
      { idNegocio: 'negocio-1' },
    );
    expect(resultado).toEqual({ data: filas, total: 1, page: 1, limit: 20 });
  });

  describe('reprogramación (Bloque 4, punto 4.3)', () => {
    const T1 = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const T2 = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const reservaEn = (fecha: Date) => ({
      idReserva: 'reserva-r',
      estado: EstadoReserva.CONFIRMADA,
      fechaHoraInicio: fecha,
      cliente: CLIENTE_EMAIL,
      servicio: SERVICIO,
    });
    const filasDe = (tipo: TipoNotificacion) =>
      notificacionRepo._tabla.filas.filter((f) => f.tipo === tipo);
    /** El cron de recordatorios, leyendo de verdad la tabla falsa. */
    const correrCronCon = async (fecha: Date) => {
      reservaRepo.find.mockResolvedValue([reservaEn(fecha)]);
      notificacionRepo.find.mockImplementation(async () =>
        notificacionRepo._tabla.filas.filter((f) => f.tipo === TipoNotificacion.RECORDATORIO),
      );
      await service.programarRecordatorios();
    };

    it('crea un aviso de reprogramación con la hora nueva, en el idioma del cliente', async () => {
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        { ...CLIENTE_EMAIL, idiomaPreferido: Idioma.EN } as any,
        SERVICIO as any,
      );
      const [aviso] = filasDe(TipoNotificacion.REPROGRAMACION);
      expect(aviso).toMatchObject({
        estado: EstadoNotificacion.PENDIENTE,
        fechaHoraReserva: T2,
      });
      expect(aviso.mensaje).toContain('Booking rescheduled');
      expect(aviso.mensaje).toContain('has been rescheduled to');
    });

    it('anula (sin borrar) el recordatorio pendiente que tenía la hora anterior', async () => {
      await correrCronCon(T1);
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      expect(notificacionRepo._tabla.filas).toHaveLength(2);
      expect(filasDe(TipoNotificacion.RECORDATORIO)[0]).toMatchObject({
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'REPROGRAMADA',
        fechaHoraReserva: T1,
      });
    });

    it('no toca los avisos ya enviados ni la confirmación', async () => {
      await service.programarConfirmacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await correrCronCon(T1);
      filasDe(TipoNotificacion.RECORDATORIO)[0].estado = EstadoNotificacion.ENVIADA;

      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      expect(filasDe(TipoNotificacion.RECORDATORIO)[0].estado).toBe(EstadoNotificacion.ENVIADA);
      expect(filasDe(TipoNotificacion.CONFIRMACION)[0].estado).toBe(EstadoNotificacion.PENDIENTE);
    });

    it('después de reprogramar, el cron crea el recordatorio de la hora nueva', async () => {
      await correrCronCon(T1);
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await correrCronCon(T2);

      const recordatorios = filasDe(TipoNotificacion.RECORDATORIO);
      expect(recordatorios).toHaveLength(2);
      expect(
        recordatorios.find((f) => f.fechaHoraReserva.getTime() === T2.getTime()),
      ).toMatchObject({ estado: EstadoNotificacion.PENDIENTE });
    });

    it('las anuladas nunca se envían ni se reintentan, en ninguna corrida', async () => {
      await correrCronCon(T1);
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      resend.enviarCorreo.mockResolvedValue({ exito: true });

      for (let i = 0; i < 4; i++) await service.procesarPendientes();

      const anulada = filasDe(TipoNotificacion.RECORDATORIO)[0];
      expect(anulada).toMatchObject({
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'REPROGRAMADA',
        reintentos: 0,
      });
      // Solo se envió el aviso de reprogramación.
      expect(resend.enviarCorreo).toHaveBeenCalledTimes(1);
      expect(resend.enviarCorreo.mock.calls[0][1]).toBe('Reserva reprogramada');
    });

    it('volver a una hora anterior REACTIVA el recordatorio anulado en vez de insertar otro, y el cliente lo recibe', async () => {
      await correrCronCon(T1); // recordatorio de T1, pendiente
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await service.programarReprogramacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      const anulada = filasDe(TipoNotificacion.RECORDATORIO).find(
        (f) => f.fechaHoraReserva.getTime() === T1.getTime(),
      )!;
      expect(anulada.estado).toBe(EstadoNotificacion.FALLIDA);
      anulada.reintentos = 2;
      anulada.mensaje = 'mensaje viejo';

      await correrCronCon(T1);

      const recordatoriosT1 = filasDe(TipoNotificacion.RECORDATORIO).filter(
        (f) => f.fechaHoraReserva.getTime() === T1.getTime(),
      );
      expect(recordatoriosT1).toHaveLength(1);
      expect(recordatoriosT1[0]).toMatchObject({
        idNotificacion: anulada.idNotificacion,
        estado: EstadoNotificacion.PENDIENTE,
        ultimoError: null,
        reintentos: 0,
      });
      expect(recordatoriosT1[0].mensaje).toContain('Te recordamos tu reserva');

      resend.enviarCorreo.mockResolvedValue({ exito: true });
      await service.procesarPendientes();
      expect(recordatoriosT1[0].estado).toBe(EstadoNotificacion.ENVIADA);
      expect(resend.enviarCorreo).toHaveBeenCalledWith(
        'cliente@example.com',
        'Recordatorio de tu cita',
        expect.any(String),
      );
    });

    it('volver a la hora de un aviso de reprogramación anulado también lo reactiva', async () => {
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await service.programarReprogramacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      const avisos = filasDe(TipoNotificacion.REPROGRAMACION);
      expect(avisos).toHaveLength(2);
      expect(avisos.find((f) => f.fechaHoraReserva.getTime() === T2.getTime())).toMatchObject({
        estado: EstadoNotificacion.PENDIENTE,
        ultimoError: null,
      });
      expect(avisos.find((f) => f.fechaHoraReserva.getTime() === T1.getTime())).toMatchObject({
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'REPROGRAMADA',
      });
    });

    it('un fallo REAL con la misma clave no se reactiva', async () => {
      await correrCronCon(T1);
      Object.assign(filasDe(TipoNotificacion.RECORDATORIO)[0], {
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'RECHAZADO_POR_PROVEEDOR',
        reintentos: 3,
      });
      await correrCronCon(T1);
      expect(filasDe(TipoNotificacion.RECORDATORIO)).toEqual([
        expect.objectContaining({ estado: EstadoNotificacion.FALLIDA, reintentos: 3 }),
      ]);
    });
  });

  describe('cancelación anula los avisos pendientes', () => {
    const T1 = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const T2 = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const reservaEn = (fecha: Date) => ({
      idReserva: 'reserva-c',
      estado: EstadoReserva.CONFIRMADA,
      fechaHoraInicio: fecha,
      cliente: CLIENTE_EMAIL,
      servicio: SERVICIO,
    });
    const filasDe = (tipo: TipoNotificacion) =>
      notificacionRepo._tabla.filas.filter((f) => f.tipo === tipo);
    const correrCronCon = async (fecha: Date) => {
      reservaRepo.find.mockResolvedValue([reservaEn(fecha)]);
      notificacionRepo.find.mockImplementation(async () =>
        notificacionRepo._tabla.filas.filter((f) => f.tipo === TipoNotificacion.RECORDATORIO),
      );
      await service.programarRecordatorios();
    };

    it('anula (sin borrar) el recordatorio pendiente con motivo CANCELADA y programa la cancelación', async () => {
      await correrCronCon(T1);
      await service.programarCancelacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      expect(filasDe(TipoNotificacion.RECORDATORIO)).toEqual([
        expect.objectContaining({ estado: EstadoNotificacion.FALLIDA, ultimoError: 'CANCELADA' }),
      ]);
      expect(filasDe(TipoNotificacion.CANCELACION)).toEqual([
        expect.objectContaining({ estado: EstadoNotificacion.PENDIENTE }),
      ]);
    });

    it('también anula un aviso de reprogramación pendiente', async () => {
      await service.programarReprogramacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await service.programarCancelacion(
        reservaEn(T2) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      expect(filasDe(TipoNotificacion.REPROGRAMACION)[0]).toMatchObject({
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'CANCELADA',
      });
    });

    it('no toca los avisos ya enviados ni la confirmación', async () => {
      await service.programarConfirmacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      await correrCronCon(T1);
      filasDe(TipoNotificacion.RECORDATORIO)[0].estado = EstadoNotificacion.ENVIADA;

      await service.programarCancelacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      expect(filasDe(TipoNotificacion.RECORDATORIO)[0].estado).toBe(EstadoNotificacion.ENVIADA);
      expect(filasDe(TipoNotificacion.CONFIRMACION)[0].estado).toBe(EstadoNotificacion.PENDIENTE);
    });

    it('las anuladas por cancelación nunca se envían ni se reintentan: el cliente solo recibe la cancelación', async () => {
      await correrCronCon(T1);
      await service.programarCancelacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );
      resend.enviarCorreo.mockResolvedValue({ exito: true });

      for (let i = 0; i < 4; i++) await service.procesarPendientes();

      expect(filasDe(TipoNotificacion.RECORDATORIO)[0]).toMatchObject({
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: 'CANCELADA',
        reintentos: 0,
      });
      expect(resend.enviarCorreo).toHaveBeenCalledTimes(1);
      expect(resend.enviarCorreo.mock.calls[0][1]).toBe('Reserva cancelada');
    });

    it('una anulada por cancelación nunca se reactiva, aunque se vuelva a programar la misma clave', async () => {
      await correrCronCon(T1);
      await service.programarCancelacion(
        reservaEn(T1) as any,
        CLIENTE_EMAIL as any,
        SERVICIO as any,
      );

      await correrCronCon(T1); // aunque el cron volviera a ver la reserva

      expect(filasDe(TipoNotificacion.RECORDATORIO)).toEqual([
        expect.objectContaining({ estado: EstadoNotificacion.FALLIDA, ultimoError: 'CANCELADA' }),
      ]);
    });
  });
});
