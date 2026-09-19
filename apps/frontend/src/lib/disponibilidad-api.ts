import { apiFetch } from './api';

export interface Disponibilidad {
  idDisponibilidad: string;
  idUsuario: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export const disponibilidadApi = {
  /** Sin idUsuario trae la disponibilidad de TODO el negocio (usada para pintar el calendario). */
  listar: (idUsuario?: string) =>
    apiFetch<Disponibilidad[]>(
      idUsuario ? `/disponibilidad?idUsuario=${idUsuario}` : '/disponibilidad',
    ),
};
