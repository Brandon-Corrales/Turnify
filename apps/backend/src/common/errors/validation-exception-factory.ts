import { BadRequestException, ValidationError } from '@nestjs/common';

function firstMessage(errors: ValidationError[]): { message: string; field?: string } {
  const first = errors[0];
  const constraintMessages = first?.constraints ? Object.values(first.constraints) : [];
  return {
    message: constraintMessages[0] ?? 'Datos de entrada inválidos',
    field: first?.property,
  };
}

/** `exceptionFactory` del ValidationPipe global: mapea class-validator al ApiError estándar. */
export function validationExceptionFactory(errors: ValidationError[]) {
  const { message, field } = firstMessage(errors);
  return new BadRequestException({
    errorCode: 'VALIDACION_FALLIDA',
    message,
    field,
  });
}
