import { apiFetch } from './api';
import type { TipoNegocio } from './tipo-negocio';

export type PlanSuscripcion = 'gratis' | 'basico' | 'premium' | 'empresarial';

export interface Negocio {
  idNegocio: string;
  nombre: string;
  tipoNegocio: TipoNegocio;
  correoElectronico: string;
  telefono?: string;
  direccion?: string;
  estado: string;
  planSuscripcion: PlanSuscripcion;
  /** Zona horaria IANA (Bloque 5). Opcional: un backend anterior no la manda. */
  zonaHoraria?: string;
}

export const negociosApi = {
  obtenerMiNegocio: () => apiFetch<Negocio>('/negocios/mi-negocio'),
  actualizarMiNegocio: (cambios: Partial<Pick<Negocio, 'zonaHoraria'>>) =>
    apiFetch<Negocio>('/negocios/mi-negocio', { method: 'PATCH', body: cambios }),
};
