import {
  guardarTokens,
  limpiarTokens,
  obtenerAccessToken,
  obtenerRefreshToken,
} from './token-storage';

const BASE_URL = import.meta.env.VITE_API_URL;

/** Misma forma de error que el filtro global del backend: {statusCode, errorCode, message, field?}. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface OpcionesApi extends Omit<RequestInit, 'body'> {
  /** false para /auth/login, /auth/registro, etc. — no manda Authorization ni intenta refrescar en 401. */
  autenticado?: boolean;
  body?: unknown;
}

let alSesionExpirada: (() => void) | null = null;

/** AuthProvider se suscribe aquí para reaccionar cuando el refresh token también expiró/fue revocado. */
export function registrarAlSesionExpirada(cb: () => void): void {
  alSesionExpirada = cb;
}

let refrescoEnCurso: Promise<string | null> | null = null;

async function refrescarSesion(): Promise<string | null> {
  const refreshToken = obtenerRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      limpiarTokens();
      return null;
    }
    const data: { accessToken: string; refreshToken: string } = await res.json();
    guardarTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Cliente HTTP único para toda la app: adjunta el access token, y si una
 * request autenticada responde 401, intenta refrescar UNA vez (varias
 * llamadas simultáneas comparten el mismo refresh en curso, para no
 * disparar varios /auth/refresh en paralelo) y reintenta la request
 * original antes de rendirse.
 */
export async function apiFetch<T>(path: string, opciones: OpcionesApi = {}): Promise<T> {
  const { autenticado = true, body, ...resto } = opciones;

  const ejecutar = (): Promise<Response> => {
    const headers = new Headers(resto.headers);
    headers.set('Content-Type', 'application/json');
    if (autenticado) {
      const token = obtenerAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${BASE_URL}${path}`, {
      ...resto,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await ejecutar();

  if (res.status === 401 && autenticado) {
    refrescoEnCurso ??= refrescarSesion().finally(() => {
      refrescoEnCurso = null;
    });
    const nuevoAccessToken = await refrescoEnCurso;

    if (nuevoAccessToken) {
      res = await ejecutar();
    } else {
      alSesionExpirada?.();
    }
  }

  if (!res.ok) {
    let cuerpo: Partial<{ errorCode: string; message: string; field: string }> = {};
    try {
      cuerpo = await res.json();
    } catch {
      // respuesta sin cuerpo JSON (ej. error de red/proxy)
    }
    throw new ApiError(
      res.status,
      cuerpo.errorCode ?? 'ERROR_DESCONOCIDO',
      cuerpo.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      cuerpo.field,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
