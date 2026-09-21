/**
 * Persistencia de tokens en localStorage. El backend no usa cookies
 * httpOnly (devuelve los tokens en el body de la respuesta), así que el
 * frontend necesariamente los maneja accesibles por JS de un modo u otro
 * — localStorage es la opción estándar en ese escenario. La mitigación
 * real contra robo de token ya vive en el backend (access token de vida
 * corta + refresh rotativo con detección de reuso, ver PROGRESS.md);
 * mover a cookies httpOnly requeriría cambios ahí, fuera del alcance de
 * esta tarjeta de frontend.
 */
const CLAVE_ACCESS = 'turnify:accessToken';
const CLAVE_REFRESH = 'turnify:refreshToken';

export function obtenerAccessToken(): string | null {
  return localStorage.getItem(CLAVE_ACCESS);
}

export function obtenerRefreshToken(): string | null {
  return localStorage.getItem(CLAVE_REFRESH);
}

export function guardarTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(CLAVE_ACCESS, accessToken);
  localStorage.setItem(CLAVE_REFRESH, refreshToken);
}

export function limpiarTokens(): void {
  localStorage.removeItem(CLAVE_ACCESS);
  localStorage.removeItem(CLAVE_REFRESH);
}
