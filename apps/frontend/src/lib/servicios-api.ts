import { apiFetch } from './api';

export interface Servicio {
  idServicio: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precio: string;
  activo: boolean;
  colorCalendario?: string;
}

export interface CrearServicioPayload {
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precio: number;
  colorCalendario?: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const serviciosApi = {
  crear: (payload: CrearServicioPayload) =>
    apiFetch<Servicio>('/servicios', { method: 'POST', body: payload }),
  listar: (page = 1, limit = 20) =>
    apiFetch<PaginatedResult<Servicio>>(
      `/servicios?${new URLSearchParams({ page: String(page), limit: String(limit) }).toString()}`,
    ),
  actualizar: (idServicio: string, payload: Partial<CrearServicioPayload>) =>
    apiFetch<Servicio>(`/servicios/${idServicio}`, { method: 'PATCH', body: payload }),
  desactivar: (idServicio: string) =>
    apiFetch<void>(`/servicios/${idServicio}`, { method: 'DELETE' }),
};
