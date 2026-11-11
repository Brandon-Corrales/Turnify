import { describe, expect, it, vi } from 'vitest';
import { crearValidadorCors } from './cors.config';

describe('CORS validator', () => {
  const allowed = new Set(['http://localhost:5173', 'https://turnify.com']);
  const validator = crearValidadorCors(allowed);

  it('permite solicitudes sin origin (como herramientas internas o curl)', () => {
    const cb = vi.fn();
    validator(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('permite orígenes autorizados exactos o con barra final', () => {
    const cb = vi.fn();
    validator('http://localhost:5173', cb);
    expect(cb).toHaveBeenCalledWith(null, true);

    const cb2 = vi.fn();
    validator('https://turnify.com/', cb2);
    expect(cb2).toHaveBeenCalledWith(null, true);
  });

  it('rechaza orígenes no autorizados sin lanzar Error (callback(null, false))', () => {
    const cb = vi.fn();
    validator('https://evil.example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, false);
  });
});
