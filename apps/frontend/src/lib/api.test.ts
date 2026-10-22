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
  let i18n: typeof import('@/i18n/config').default;
  const fetchMock = vi.fn();

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock);
    ({ apiFetch } = await import('./api'));
    i18n = (await import('@/i18n/config')).default;
  });

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    fetchMock.mockClear();
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
});