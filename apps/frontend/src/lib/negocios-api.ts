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
}

export const negociosApi = {
  obtenerMiNegocio: () => apiFetch<Negocio>('/negocios/mi-negocio'),
};
