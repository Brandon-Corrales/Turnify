import { apiFetch } from './api';

export interface Disponibilidad {
  idDisponibilidad: string;
  idUsuario: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface GuardarDisponibilidadPayload {
  idUsuario: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export const disponibilidadApi = {
  /** Sin idUsuario trae la disponibilidad de TODO el negocio (usada para pintar el calendario). */
  listar: (idUsuario?: string) =>
    apiFetch<Disponibilidad[]>(
      idUsuario ? `/disponibilidad?idUsuario=${idUsuario}` : '/disponibilidad',
    ),
  crear: (payload: GuardarDisponibilidadPayload) =>
    apiFetch<Disponibilidad>('/disponibilidad', { method: 'POST', body: payload }),
  actualizar: (
    idDisponibilidad: string,
    payload: Partial<Omit<GuardarDisponibilidadPayload, 'idUsuario'>> & { activo?: boolean },
  ) =>
    apiFetch<Disponibilidad>(`/disponibilidad/${idDisponibilidad}`, {
      method: 'PATCH',
      body: payload,
    }),
  eliminar: (idDisponibilidad: string) =>
    apiFetch<void>(`/disponibilidad/${idDisponibilidad}`, { method: 'DELETE' }),
};
