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

export const serviciosApi = {
  crear: (payload: CrearServicioPayload) =>
    apiFetch<Servicio>('/servicios', { method: 'POST', body: payload }),
};
