import { ApiProperty } from '@nestjs/swagger';

/**
 * Documenta en Swagger la forma estándar de error de toda la API (punto
 * 7/8 del brief), la que ya garantiza AllExceptionsFilter en runtime —
 * este DTO no se usa en código, solo describe la respuesta para /docs.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: 'VALIDACION_FALLIDA',
    description: 'Código estable para mapear a un mensaje traducido en el frontend',
  })
  errorCode!: string;

  @ApiProperty({ example: 'correoElectronico must be a valid email' })
  message!: string;

  @ApiProperty({
    example: 'correoElectronico',
    required: false,
    description: 'Presente solo en errores de validación de un campo específico',
  })
  field?: string;
}
