import type { TFunction } from 'i18next';
import { apiFetch } from './api';

export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'ausente';
export type OrigenReserva = 'online' | 'admin';

/** Compartida por Reportes, Reservas y Calendario — mismo enum, misma traducción en los tres. */
export function crearEtiquetaEstadoReserva(t: TFunction): Record<EstadoReserva, string> {
  return {
    pendiente: t('estadoReserva.pendiente'),
    confirmada: t('estadoReserva.confirmada'),
    cancelada: t('estadoReserva.cancelada'),
    ausente: t('estadoReserva.ausente'),
  };
}

export interface Reserva {
  idReserva: string;
  idNegocio: string;
  idCliente: string;
  idServicio: string;
  idUsuario: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  estado: EstadoReserva;
  notas?: string;
  origen: OrigenReserva;
  // El backend siempre las incluye (ver relations en ReservasService) —
  // sin esto el calendario solo tendría los UUID crudos de las FK.
  cliente: { nombreCompleto: string };
  servicio: { nombre: string; colorCalendario?: string };
  usuario: { nombreCompleto: string };
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListarReservasParams {
  desde?: string;
  hasta?: string;
  idUsuario?: string;
  estado?: EstadoReserva;
  page?: number;
  limit?: number;
}

export interface ReprogramarPayload {
  fechaHoraInicio: string;
}

export interface CrearReservaPayload {
  idCliente: string;
  idServicio: string;
  idUsuario: string;
  fechaHoraInicio: string;
  notas?: string;
}

function construirQuery(params: Record<string, string | number | undefined>): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
}

/** El backend limita `limit` a 100 (PaginationQueryDto, @Max(100), compartido por todos los listados) — no se puede pedir más por página. */
const LIMITE_MAXIMO_BACKEND = 100;

export const reservasApi = {
  /** Sin `origen`: el backend lo defaultea a ADMIN (CrearReservaDto), que es justo lo que corresponde para una reserva creada por el propio negocio desde el Calendario. */
  crear: (payload: CrearReservaPayload) =>
    apiFetch<Reserva>('/reservas', { method: 'POST', body: payload }),

  listar: ({
    desde,
    hasta,
    idUsuario,
    estado,
    page,
    limit = LIMITE_MAXIMO_BACKEND,
  }: ListarReservasParams) =>
    apiFetch<PaginatedResult<Reserva>>(
      `/reservas${construirQuery({ desde, hasta, idUsuario, estado, page, limit })}`,
    ),

  cancelar: (idReserva: string) =>
    apiFetch<Reserva>(`/reservas/${idReserva}/cancelar`, { method: 'PATCH' }),

  reprogramar: (idReserva: string, payload: ReprogramarPayload) =>
    apiFetch<Reserva>(`/reservas/${idReserva}/reprogramar`, { method: 'PATCH', body: payload }),
};
