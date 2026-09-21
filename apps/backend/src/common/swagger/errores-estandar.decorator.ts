import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../errors/error-response.dto';

/**
 * Documenta en /docs la forma estándar de error (punto 7/8 del brief)
 * para los códigos de estado más comunes de un endpoint autenticado —
 * aplicado a nivel de clase, cubre todos sus endpoints sin repetir
 * @ApiResponse en cada uno (mismo principio de "nunca repetido a mano"
 * del resto de guards/wrappers transversales del proyecto).
 */
export function ErroresEstandar(): ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({ status: 400, description: 'Solicitud inválida', type: ErrorResponseDto }),
    ApiResponse({ status: 401, description: 'No autenticado', type: ErrorResponseDto }),
    ApiResponse({ status: 403, description: 'No autorizado', type: ErrorResponseDto }),
    ApiResponse({ status: 404, description: 'No encontrado', type: ErrorResponseDto }),
  ) as ClassDecorator;
}
