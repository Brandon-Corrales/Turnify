import { apiFetch } from './api';

export interface NegocioPublico {
  idNegocio: string;
  nombre: string;
  tipoNegocio: string;
}

export interface ServicioPublico {
  idServicio: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precio: string;
  colorCalendario?: string;
}

export interface DatosClientePublico {
  nombreCompleto: string;
  correoElectronico: string;
  telefono?: string;
}

export interface CrearReservaPublicaPayload {
  idServicio: string;
  fechaHoraInicio: string;
  cliente: DatosClientePublico;
}

export interface ReservaPublicaCreada {
  idReserva: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
}

/** Todas sin sesión (autenticado: false) — el visitante del wizard nunca tiene un JWT. */
export const reservaPublicaApi = {
  obtenerNegocio: (idNegocio: string) =>
    apiFetch<NegocioPublico>(`/publico/negocios/${idNegocio}`, { autenticado: false }),

  listarServicios: (idNegocio: string) =>
    apiFetch<ServicioPublico[]>(`/publico/negocios/${idNegocio}/servicios`, {
      autenticado: false,
    }),

  listarHorarios: (idNegocio: string, idServicio: string, fecha: string) =>
    apiFetch<string[]>(
      `/publico/negocios/${idNegocio}/horarios?${new URLSearchParams({ idServicio, fecha }).toString()}`,
      { autenticado: false },
    ),

  crearReserva: (idNegocio: string, payload: CrearReservaPublicaPayload) =>
    apiFetch<ReservaPublicaCreada>(`/publico/negocios/${idNegocio}/reservas`, {
      method: 'POST',
      body: payload,
      autenticado: false,
    }),
};
