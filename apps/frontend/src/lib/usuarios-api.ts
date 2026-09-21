import { apiFetch } from './api';

export interface UsuarioResumen {
  idUsuario: string;
  nombreCompleto: string;
  rol: 'admin' | 'empleado';
  activo: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export const usuariosApi = {
  /** limit=100: alcanza para el filtro de empleados del calendario sin construir paginación completa para un <select>. */
  listar: () => apiFetch<PaginatedResult<UsuarioResumen>>('/usuarios?limit=100'),
};
