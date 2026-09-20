import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificacionesService } from './notificaciones.service';
import {
  CanalNotificacion,
  CanalPreferido,
  EstadoNotificacion,
  Idioma,
  TipoNotificacion,
} from '../../database/entities';

function crearNotificacionRepoMock() {
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
  return {
    create: vi.fn((data) => data),
    save: vi.fn((data) => Promise.resolve({ idNotificacion: 'notif-nueva', ...data })),
    find: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    createQueryBuilder: vi.fn(() => queryBuilder),
    _queryBuilder: queryBuilder,
  };
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

const RESERVA = {
  idReserva: 'reserva-1',
  fechaHoraInicio: new Date('2027-03-01T16:00:00.000Z'),
};

const SERVICIO = { idServicio: 'servicio-1', nombre: 'Corte de cabello' };

describe('NotificacionesService', () => {
  let notificacionRepo: ReturnType<typeof crearNotificacionRepoMock>;
  let resend: ReturnType<typeof crearProviderMock>;
  let whatsapp: ReturnType<typeof crearProviderMock>;
  let i18n: ReturnType<typeof crearI18nMock>;
  let service: NotificacionesService;

  beforeEach(() => {
    notificacionRepo = crearNotificacionRepoMock();
    resend = crearProviderMock();
    whatsapp = crearProviderMock();
    i18n = crearI18nMock();
    service = new NotificacionesService(
      notificacionRepo as any,
      resend as any,
      whatsapp as any,
      i18n as any,
    );
  });

  it('programarConfirmacion() crea una notificación pendiente con el canal preferido del cliente', async () => {
    await service.programarConfirmacion(RESERVA as any, CLIENTE_EMAIL as any, SERVICIO as any);
    expect(notificacionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idReserva: 'reserva-1',
        idCliente: 'cliente-1',
        tipo: TipoNotificacion.CONFIRMACION,
        canal: CanalNotificacion.EMAIL,
        estado: EstadoNotificacion.PENDIENTE,
        reintentos: 0,
      }),
    );
  });

  it('programarConfirmacion() genera el mensaje en inglés si el cliente prefiere inglés', async () => {
    await service.programarConfirmacion(
      RESERVA as any,
      { ...CLIENTE_EMAIL, idiomaPreferido: Idioma.EN } as any,
      SERVICIO as any,
    );
    const guardado = notificacionRepo.save.mock.calls[0][0];
    expect(guardado.mensaje).toContain('Booking confirmed');
    expect(guardado.mensaje).toContain('confirmed');
  });

  it('procesarPendientes() envía por Resend cuando el canal es email y marca ENVIADA', async () => {
    notificacionRepo.find.mockResolvedValue([
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
      expect.objectContaining({ estado: EstadoNotificacion.ENVIADA }),
    );
  });

  it('procesarPendientes() envía por WhatsApp Cloud API cuando el canal es whatsapp', async () => {
    notificacionRepo.find.mockResolvedValue([
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
    notificacionRepo.find.mockResolvedValue([
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
      { reintentos: 1, estado: EstadoNotificacion.PENDIENTE },
    );
  });

  it('procesarPendientes() marca FALLIDA al agotar los reintentos', async () => {
    notificacionRepo.find.mockResolvedValue([
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
      { reintentos: 3, estado: EstadoNotificacion.FALLIDA },
    );
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
});
