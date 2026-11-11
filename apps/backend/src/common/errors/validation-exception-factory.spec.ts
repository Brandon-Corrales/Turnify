import { describe, expect, it } from 'vitest';
import { ValidationError } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception-factory';

describe('validationExceptionFactory', () => {
  it('extrae el mensaje de error plano en el primer nivel', () => {
    const error: ValidationError = {
      property: 'correo',
      constraints: { isEmail: 'Debe ser un correo válido' },
      children: [],
    };
    const exception = validationExceptionFactory([error]);
    expect(exception.getResponse()).toEqual({
      errorCode: 'VALIDACION_FALLIDA',
      message: 'Debe ser un correo válido',
      field: 'correo',
    });
  });

  it('extrae el mensaje de error anidado en DTOs hijos (ValidateNested)', () => {
    const childError: ValidationError = {
      property: 'nombreCompleto',
      constraints: { terminosPermitidos: 'validacion.TERMINO_BLOQUEADO|{}' },
      children: [],
    };
    const parentError: ValidationError = {
      property: 'cliente',
      children: [childError],
    };

    const exception = validationExceptionFactory([parentError]);
    expect(exception.getResponse()).toEqual({
      errorCode: 'VALIDACION_FALLIDA',
      message: 'validacion.TERMINO_BLOQUEADO|{}',
      field: 'nombreCompleto',
    });
  });
});
