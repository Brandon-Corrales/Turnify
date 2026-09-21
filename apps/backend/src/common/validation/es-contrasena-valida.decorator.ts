import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

/**
 * Política mínima de contraseña del sistema: 8+ caracteres, al menos una
 * letra y un número. Mensaje vía i18nValidationMessage (punto 10 del
 * brief) — resuelve el idioma desde I18nContext en el momento de la
 * validación, así que llega ya traducido a validationExceptionFactory
 * sin que este decorador ni la factory sepan nada de idiomas.
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = i18nValidationMessage('validacion.CONTRASENA_INVALIDA');

export function EsContrasenaValida(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: PASSWORD_MESSAGE }),
    Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }),
  );
}
