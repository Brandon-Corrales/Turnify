import { apiFetch } from './api';

export interface NegocioPublico {
  idNegocio: string;
  nombre: string;
  tipoNegocio: string;
  /** Zona horaria IANA del negocio (Bloque 5). Opcional: un backend anterior no la manda. */
  zonaHoraria?: string;
  /** Moneda ISO 4217 en la que se muestran los precios (Bloque 5). */
  moneda?: string;
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
  honeypot?: string;
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
