import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { ErrorCodeException } from '../../../common/errors/api-error.interface';
import { WsExceptionsFilter } from './ws-exceptions.filter';

function crearHostMock(lang: string | undefined) {
  const emitMock = vi.fn();
  const client = { emit: emitMock };
  const host = {
    switchToWs: () => ({ getClient: () => client }),
  } as any;

  vi.spyOn(I18nContext, 'current').mockReturnValue(lang ? ({ lang } as any) : undefined);

  return { host, emitMock };
}

describe('WsExceptionsFilter', () => {
  let i18n: { translate: ReturnType<typeof vi.fn> };
  let filter: WsExceptionsFilter;

  beforeEach(() => {
    i18n = { translate: vi.fn((_key: string, opts: any) => opts.defaultValue) };
    filter = new WsExceptionsFilter(i18n as any);
  });

  it('emite error-chatbot con el errorCode/mensaje real de un HttpException con forma estándar (ej. LimitePlanGratisGuard)', () => {
    i18n.translate.mockReturnValue('El Plan Gratis permite hasta 10 mensajes al chatbot por día.');
    const { host, emitMock } = crearHostMock('es');

    filter.catch(
      new ForbiddenException({
        errorCode: 'LIMITE_PLAN_ALCANZADO',
        message: 'Límite del Plan Gratis alcanzado (mensajesChatbot)',
      }),
      host,
    );

    expect(emitMock).toHaveBeenCalledWith('error-chatbot', {
      statusCode: 403,
      errorCode: 'LIMITE_PLAN_ALCANZADO',
      message: 'El Plan Gratis permite hasta 10 mensajes al chatbot por día.',
    });
  });

  it('emite error-chatbot de un ErrorCodeException traducido', () => {
    i18n.translate.mockReturnValue('Token de acceso inválido o expirado');
    const { host, emitMock } = crearHostMock('es');

    filter.catch(new ErrorCodeException('TOKEN_INVALIDO', 'Token inválido', 401), host);

    expect(emitMock).toHaveBeenCalledWith('error-chatbot', {
      statusCode: 401,
      errorCode: 'TOKEN_INVALIDO',
      message: 'Token de acceso inválido o expirado',
    });
  });

  it('nunca deja pasar un error interno sin manejar: se degrada a ERROR_INTERNO', () => {
    i18n.translate.mockReturnValue('Ocurrió un error inesperado. Intenta de nuevo más tarde.');
    const { host, emitMock } = crearHostMock(undefined);

    filter.catch(new Error('boom'), host);

    expect(emitMock).toHaveBeenCalledWith('error-chatbot', {
      statusCode: 500,
      errorCode: 'ERROR_INTERNO',
      message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    });
  });
});
