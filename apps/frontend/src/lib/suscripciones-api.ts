import { apiFetch } from './api';

export interface LimitesPlanes {
  gratis: {
    usuarios: number;
    servicios: number;
    reservasPorMes: number;
    mensajesChatbotPorDia: number;
  };
}

export type EstadoSuscripcion = 'activa' | 'cancelada' | 'suspendida';

export interface Suscripcion {
  idSuscripcion: string;
  idNegocio: string;
  plan: 'gratis' | 'basico' | 'premium' | 'empresarial';
  estado: EstadoSuscripcion;
  montoMensual?: string;
  fechaInicio: string;
  fechaFin?: string;
}

export const suscripcionesApi = {
  /** Público (landing sin sesión) — números reales del Plan Gratis, fuente única con el backend. */
  obtenerPlanes: () => apiFetch<LimitesPlanes>('/suscripciones/planes', { autenticado: false }),
  obtenerMiSuscripcion: () => apiFetch<Suscripcion>('/suscripciones/mi-suscripcion'),
  /** Devuelve la URL de Stripe Checkout (Test Mode) — el llamador debe redirigir el navegador ahí. */
  iniciarCheckout: (successUrl: string, cancelUrl: string) =>
    apiFetch<{ url: string }>('/suscripciones/checkout', {
      method: 'POST',
      body: { successUrl, cancelUrl },
    }),
};
