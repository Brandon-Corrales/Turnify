import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RolUsuario } from '../../../database/entities';

/**
 * No incluye `activo`: la desactivación tiene su propio endpoint
 * (DELETE /usuarios/:id → soft delete). Reactivar un usuario soft-deleted
 * no está en el alcance de esta tarjeta.
 */
export class ActualizarUsuarioDto {
  @ApiProperty({ required: false, example: 'Carlos Empleado' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompleto?: string;

  @ApiProperty({ required: false, example: '+506 8888-0002' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false, enum: RolUsuario })
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;
}
