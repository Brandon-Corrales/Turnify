import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import type { Socket } from 'socket.io';
import { ErrorCodeException } from '../../../common/errors/api-error.interface';
import type { ApiError } from '../../../common/errors/api-error.interface';

const DEFAULT_ERROR_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'SOLICITUD_INVALIDA',
  [HttpStatus.UNAUTHORIZED]: 'NO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'NO_AUTORIZADO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLICTO',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADAS_SOLICITUDES',
};

/**
 * Equivalente de AllExceptionsFilter (misma forma de error, mismo i18n por
 * errorCode) pero para el transporte WebSocket del Chatbot. Necesario
 * porque el manejador de excepciones WS por defecto de Nest NO desempaca
 * `HttpException.getResponse()` como sí hace AllExceptionsFilter — sin
 * este filtro, cualquier guard reusado de HTTP (p.ej. LimitePlanGratisGuard,
 * que lanza ForbiddenException) llega al cliente como un genérico
 * "Internal server error", perdiendo el errorCode/mensaje real (error real,
 * encontrado al verificar el límite del Plan Gratis del chatbot de punta a
 * punta con una conexión real).
 *
 * Emite un evento propio (`error-chatbot`) en vez de relanzar — así el
 * cliente recibe la forma estándar de error también en este transporte,
 * y la conexión del socket no se cierra.
 */
@Catch()
export class WsExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('WsExceptionsFilter');

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const lang = I18nContext.current(host)?.lang;

    if (exception instanceof ErrorCodeException) {
      this.emitir(client, {
        statusCode: exception.statusCode,
        errorCode: exception.errorCode,
        message: this.traducir(exception.errorCode, exception.message, lang),
        field: exception.field,
      });
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
        this.emitir(client, {
          statusCode: status,
          errorCode,
          message: this.traducir(errorCode, Array.isArray(message) ? message[0] : message, lang),
          field,
        });
        return;
      }

      const message = typeof body === 'string' ? body : exception.message;
      const errorCode = DEFAULT_ERROR_CODE_BY_STATUS[status] ?? 'ERROR_HTTP';
      this.emitir(client, {
        statusCode: status,
        errorCode,
        message: this.traducir(errorCode, message, lang),
      });
      return;
    }

    this.logger.error(
      'Excepción no controlada en el WebSocket del chatbot',
      exception instanceof Error ? exception.stack : String(exception),
    );
    this.emitir(client, {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'ERROR_INTERNO',
      message: this.traducir(
        'ERROR_INTERNO',
        'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
        lang,
      ),
    });
  }

  private traducir(errorCode: string, mensajeOriginal: string, lang: string | undefined): string {
    return this.i18n.translate(`errores.${errorCode}`, { lang, defaultValue: mensajeOriginal });
  }

  private emitir(client: Socket, error: ApiError): void {
    client.emit('error-chatbot', error);
  }
}
