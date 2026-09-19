import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

/** Política mínima de contraseña del sistema: 8+ caracteres, al menos una letra y un número. */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';

export function EsContrasenaValida(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: PASSWORD_MESSAGE }),
    Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }),
  );
}
