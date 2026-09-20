import { apiFetch } from './api';

export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'ausente';
export type OrigenReserva = 'online' | 'admin';

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
