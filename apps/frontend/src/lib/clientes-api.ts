import { apiFetch } from './api';

export type CanalPreferido = 'email' | 'whatsapp';
export type IdiomaPreferido = 'es' | 'en';
export type NivelCliente = 'gratis' | 'premium';

export interface Cliente {
  idCliente: string;
  nombreCompleto: string;
  correoElectronico: string;
  telefono?: string;
  notas?: string;
  canalPreferido: CanalPreferido;
  idiomaPreferido: IdiomaPreferido;
  nivelCliente: NivelCliente;
  activo: boolean;
}

export interface GuardarClientePayload {
  nombreCompleto: string;
  correoElectronico: string;
  telefono?: string;
  notas?: string;
  canalPreferido?: CanalPreferido;
  idiomaPreferido?: IdiomaPreferido;
  nivelCliente?: NivelCliente;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const clientesApi = {
  listar: (page = 1, limit = 20) =>
    apiFetch<PaginatedResult<Cliente>>(
      `/clientes?${new URLSearchParams({ page: String(page), limit: String(limit) }).toString()}`,
    ),
  crear: (payload: GuardarClientePayload) =>
    apiFetch<Cliente>('/clientes', { method: 'POST', body: payload }),
  actualizar: (idCliente: string, payload: Partial<GuardarClientePayload>) =>
    apiFetch<Cliente>(`/clientes/${idCliente}`, { method: 'PATCH', body: payload }),
  desactivar: (idCliente: string) => apiFetch<void>(`/clientes/${idCliente}`, { method: 'DELETE' }),
};
