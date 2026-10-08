import { apiFetch } from './api';

export type TipoNotificacion = 'recordatorio' | 'confirmacion' | 'cancelacion';
export type CanalNotificacion = 'email' | 'whatsapp' | 'sms';
export type EstadoNotificacion = 'pendiente' | 'enviada' | 'fallida';
export type MotivoFallo =
  | 'DESTINATARIO_NO_HABILITADO'
  | 'CREDENCIALES_FALTANTES'
  | 'CANAL_SIN_PROVEEDOR'
  | 'RECHAZADO_POR_PROVEEDOR';

export interface Notificacion {
  idNotificacion: string;
  tipo: TipoNotificacion;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  programadoPara: string;
  enviadoEn?: string | null;
  mensaje: string;
  reintentos: number;
  /**
   * Categoría del último intento fallido (nunca el texto crudo del
   * proveedor, que puede traer datos de terceros). Se traduce en pantalla.
   */
  ultimoError?: MotivoFallo | null;
  creadoEn: string;
  cliente: { idCliente: string; nombreCompleto: string };
  reserva?: { fechaHoraInicio: string; servicio?: { nombre: string } };
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const notificacionesApi = {
  listar: (page = 1, limit = 20) =>
    apiFetch<PaginatedResult<Notificacion>>(
      `/notificaciones?${new URLSearchParams({ page: String(page), limit: String(limit) }).toString()}`,
    ),
};
