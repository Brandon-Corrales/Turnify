import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorCodeException } from './api-error.interface';

function crearHostMock(lang: string | undefined) {
  const jsonMock = vi.fn().mockReturnThis();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const response = { status: statusMock };
  const request = { method: 'POST', url: '/reservas' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as any;

  vi.spyOn(I18nContext, 'current').mockReturnValue(lang ? ({ lang } as any) : undefined);

  return { host, statusMock, jsonMock };
}

describe('AllExceptionsFilter', () => {
  let i18n: { translate: ReturnType<typeof vi.fn> };
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    i18n = { translate: vi.fn((key: string, opts: any) => opts.defaultValue) };
    filter = new AllExceptionsFilter(i18n as any);
  });

  it('traduce el mensaje de un ErrorCodeException usando el idioma resuelto por I18nContext', () => {
    i18n.translate.mockReturnValue('That email is already registered');
    const { host, statusMock, jsonMock } = crearHostMock('en');

    filter.catch(
      new ErrorCodeException('EMAIL_YA_REGISTRADO', 'Ese correo ya está registrado', 409),
      host,
    );

    expect(i18n.translate).toHaveBeenCalledWith('errores.EMAIL_YA_REGISTRADO', {
      lang: 'en',
      defaultValue: 'Ese correo ya está registrado',
    });
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'EMAIL_YA_REGISTRADO',
        message: 'That email is already registered',
      }),
    );
  });

  it('usa el mensaje original si el errorCode no tiene traducción (defaultValue)', () => {
    const { host, jsonMock } = crearHostMock('en');

    filter.catch(new ErrorCodeException('ALGO_SIN_TRADUCIR', 'Mensaje original', 400), host);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'ALGO_SIN_TRADUCIR', message: 'Mensaje original' }),
    );
  });

  it('traduce excepciones HttpException estándar (ej. ConflictException con errorCode) igual que ErrorCodeException', () => {
    i18n.translate.mockReturnValue('This booking was already cancelled');
    const { host, jsonMock } = crearHostMock('en');

    filter.catch(
      new ConflictException({
        errorCode: 'RESERVA_YA_CANCELADA',
        message: 'Esta reserva ya estaba cancelada',
      }),
      host,
    );

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'RESERVA_YA_CANCELADA',
        message: 'This booking was already cancelled',
      }),
    );
  });

  it('sin I18nContext (lang undefined), sigue respondiendo con el idioma de fallback de i18n', () => {
    i18n.translate.mockReturnValue('Ocurrió un error inesperado. Intenta de nuevo más tarde.');
    const { host, jsonMock } = crearHostMock(undefined);

    filter.catch(new Error('boom'), host);

    expect(i18n.translate).toHaveBeenCalledWith(
      'errores.ERROR_INTERNO',
      expect.objectContaining({ lang: undefined }),
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, errorCode: 'ERROR_INTERNO' }),
    );
  });
});
