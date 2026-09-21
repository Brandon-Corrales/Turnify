import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
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

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = I18nContext.current(host)?.lang;

    if (exception instanceof ErrorCodeException) {
      this.respond(
        response,
        exception.statusCode,
        exception.errorCode,
        this.traducir(exception.errorCode, exception.message, lang),
        exception.field,
      );
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
        this.respond(
          response,
          status,
          errorCode,
          this.traducir(errorCode, Array.isArray(message) ? message[0] : message, lang),
          field,
        );
        return;
      }

      const message = typeof body === 'string' ? body : exception.message;
      const errorCode = DEFAULT_ERROR_CODE_BY_STATUS[status] ?? 'ERROR_HTTP';
      this.respond(response, status, errorCode, this.traducir(errorCode, message, lang));
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
      this.traducir(
        'ERROR_INTERNO',
        'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
        lang,
      ),
    );
  }

  /**
   * Traduce por errorCode (punto 10 del brief) cuando existe una clave en
   * i18n/{lang}/errores.json — `defaultValue` cubre los pocos errorCodes
   * sin traducción todavía (usa el mensaje original tal cual en vez de
   * romper la respuesta).
   */
  private traducir(errorCode: string, mensajeOriginal: string, lang: string | undefined): string {
    return this.i18n.translate(`errores.${errorCode}`, { lang, defaultValue: mensajeOriginal });
  }

  private respond(
    response: Response,
    statusCode: number,
    errorCode: string,
    message: string,
    field?: string,
  ): void {
    response
      .status(statusCode)
      .json({ statusCode, errorCode, message, ...(field ? { field } : {}) });
  }
}
