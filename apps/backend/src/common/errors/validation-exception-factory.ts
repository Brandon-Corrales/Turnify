import { BadRequestException, ValidationError } from '@nestjs/common';

function findFirstLeaf(error: ValidationError): ValidationError {
  if (error.children && error.children.length > 0) {
    return findFirstLeaf(error.children[0]);
  }
  return error;
}

function firstMessage(errors: ValidationError[]): { message: string; field?: string } {
  if (!errors || errors.length === 0) {
    return { message: 'Datos de entrada inválidos' };
  }
  const leaf = findFirstLeaf(errors[0]);
  const constraintMessages = leaf?.constraints ? Object.values(leaf.constraints) : [];
  return {
    message: constraintMessages[0] ?? 'Datos de entrada inválidos',
    field: leaf?.property,
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
