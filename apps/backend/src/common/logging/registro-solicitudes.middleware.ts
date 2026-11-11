import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RegistroSolicitudesMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const inicio = Date.now();
    const requestId =
      (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string) || randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const ruta = req.originalUrl?.split('?')[0] || req.url;

    // Render consulta /health constantemente; excluir para no saturar los logs
    if (ruta === '/health') {
      next();
      return;
    }

    res.on('finish', () => {
      const duracion = Date.now() - inicio;
      const estado = res.statusCode;
      const idNegocio = (req as any).user?.idNegocio ?? 'anon';

      this.logger.log(
        `${req.method} ${ruta} ${estado} ${duracion}ms requestId=${requestId} idNegocio=${idNegocio}`,
      );
    });

    next();
  }
}
