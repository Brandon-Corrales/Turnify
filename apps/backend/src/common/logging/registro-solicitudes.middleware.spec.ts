import { describe, expect, it, vi } from 'vitest';
import { RegistroSolicitudesMiddleware } from './registro-solicitudes.middleware';

describe('RegistroSolicitudesMiddleware', () => {
  const middleware = new RegistroSolicitudesMiddleware();

  it('asigna y responde con X-Request-Id', () => {
    const req: any = { headers: {}, originalUrl: '/reservas' };
    const res: any = { setHeader: vi.fn(), on: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it('conserva X-Request-Id entrante si ya viene en la solicitud', () => {
    const req: any = { headers: { 'x-request-id': 'req-1234' }, originalUrl: '/reservas' };
    const res: any = { setHeader: vi.fn(), on: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-1234');
    expect(next).toHaveBeenCalled();
  });

  it('omite registro en /health', () => {
    const req: any = { headers: {}, originalUrl: '/health' };
    const res: any = { setHeader: vi.fn(), on: vi.fn() };
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(res.on).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
