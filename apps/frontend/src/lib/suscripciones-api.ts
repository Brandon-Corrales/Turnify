import { apiFetch } from './api';

export interface LimitesPlanes {
  gratis: {
    usuarios: number;
    servicios: number;
    reservasPorMes: number;
    mensajesChatbotPorDia: number;
  };
}

export const suscripcionesApi = {
  /** Público (landing sin sesión) — números reales del Plan Gratis, fuente única con el backend. */
  obtenerPlanes: () => apiFetch<LimitesPlanes>('/suscripciones/planes', { autenticado: false }),
};
