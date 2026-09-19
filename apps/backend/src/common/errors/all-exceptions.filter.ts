import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodeException } from './api-error.interface';

const DEFAULT_ERROR_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'SOLICITUD_INVALIDA',
  [HttpStatus.UNAUTHORIZED]: 'NO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'NO_AUTORIZADO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLICTO',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADAS_SOLICITUDES',
};

/**
 * Filtro global de excepciones: TODA respuesta de error de la API sale con
 * la misma forma `{ statusCode, errorCode, message, field? }` (punto 7 del
 * brief), y nunca se expone un stack trace ni un mensaje interno de la
 * base de datos al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ErrorCodeException) {
      this.respond(response, exception.statusCode, exception.errorCode, exception.message, exception.field);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null && 'errorCode' in body) {
        const { errorCode, message, field } = body as {
          errorCode: string;
          message: string | string[];
          field?: string;
        };
        this.respond(response, status, errorCode, Array.isArray(message) ? message[0] : message, field);
        return;
      }

      const message = typeof body === 'string' ? body : exception.message;
      this.respond(response, status, DEFAULT_ERROR_CODE_BY_STATUS[status] ?? 'ERROR_HTTP', message);
      return;
    }

    this.logger.error(
      `Excepción no controlada en ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    this.respond(
      response,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'ERROR_INTERNO',
      'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    );
  }

  private respond(
    response: Response,
    statusCode: number,
    errorCode: string,
    message: string,
    field?: string,
  ): void {
    response.status(statusCode).json({ statusCode, errorCode, message, ...(field ? { field } : {}) });
  }
}
