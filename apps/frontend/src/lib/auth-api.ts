import { apiFetch } from './api';

export type Rol = 'admin' | 'empleado';

export interface UsuarioActual {
  idUsuario: string;
  idNegocio: string;
  nombreCompleto: string;
  correoElectronico: string;
  rol: Rol;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RespuestaAuth {
  usuario: UsuarioActual;
  tokens: TokenPair;
}

export interface LoginPayload {
  correoElectronico: string;
  contrasena: string;
}

export interface RegistroPayload {
  nombreNegocio: string;
  tipoNegocio: string;
  correoNegocio: string;
  telefonoNegocio?: string;
  direccionNegocio?: string;
  nombreCompletoAdmin: string;
  correoAdmin: string;
  contrasena: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<RespuestaAuth>('/auth/login', { method: 'POST', body: payload, autenticado: false }),

  registrar: (payload: RegistroPayload) =>
    apiFetch<RespuestaAuth>('/auth/registro', {
      method: 'POST',
      body: payload,
      autenticado: false,
    }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  obtenerPerfil: () => apiFetch<UsuarioActual>('/auth/me'),
};
