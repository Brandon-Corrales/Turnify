import { apiFetch } from './api';

export type TipoNotificacion = 'recordatorio' | 'confirmacion' | 'cancelacion';
export type CanalNotificacion = 'email' | 'whatsapp' | 'sms';
export type EstadoNotificacion = 'pendiente' | 'enviada' | 'fallida';

export interface Notificacion {
  idNotificacion: string;
  tipo: TipoNotificacion;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  programadoPara: string;
  enviadoEn?: string | null;
  mensaje: string;
  reintentos: number;
  /** Motivo del último intento fallido, tal como lo devolvió el proveedor (Resend / Meta). */
  ultimoError?: string | null;
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
