import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const almacenamiento = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (clave: string) => almacenamiento.get(clave) ?? null,
  setItem: (clave: string, valor: string) => almacenamiento.set(clave, valor),
  removeItem: (clave: string) => almacenamiento.delete(clave),
});
vi.stubGlobal('window', { localStorage, UserWay: undefined });
vi.stubGlobal('document', { documentElement: { lang: 'es' } });

describe('apiFetch', () => {
  let apiFetch: typeof import('./api').apiFetch;
  let ApiError: typeof import('./api').ApiError;
  let i18n: typeof import('@/i18n/config').default;
  const fetchMock = vi.fn();

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock);
    ({ apiFetch, ApiError } = await import('./api'));
    i18n = (await import('@/i18n/config')).default;
  });

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    fetchMock.mockClear();
    almacenamiento.clear();
  });

  it.each([
    ['es', 'es'],
    ['en', 'en'],
  ])('envía Accept-Language=%s cuando el idioma activo es %s', async (idioma, esperado) => {
    await i18n.changeLanguage(idioma);

    await apiFetch('/prueba', { autenticado: false });

    const opciones = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(opciones.headers).get('Accept-Language')).toBe(esperado);
  });

  it('no borra los tokens cuando hay un error de red y lanza ApiError de tipo ERROR_RED', async () => {
    almacenamiento.set('turnify_access_token', 'token-valido');
    almacenamiento.set('turnify_refresh_token', 'refresh-valido');

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiFetch('/prueba', { autenticado: true })).rejects.toThrow(ApiError);
    expect(almacenamiento.get('turnify_access_token')).toBe('token-valido');
    expect(almacenamiento.get('turnify_refresh_token')).toBe('refresh-valido');
  });

  it('no borra los tokens cuando el servidor responde con 500', async () => {
    almacenamiento.set('turnify_access_token', 'token-valido');
    almacenamiento.set('turnify_refresh_token', 'refresh-valido');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ errorCode: 'ERROR_INTERNO', message: 'Fallo del servidor' }),
    });

    await expect(apiFetch('/prueba', { autenticado: true })).rejects.toThrow(ApiError);
    expect(almacenamiento.get('turnify_access_token')).toBe('token-valido');
    expect(almacenamiento.get('turnify_refresh_token')).toBe('refresh-valido');
  });
});
