import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ActualizarServicioDto {
  @ApiProperty({ required: false, example: 'Corte clásico' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  duracionMinutos?: number;

  @ApiProperty({ required: false, example: 8000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precio?: number;

  @ApiProperty({ required: false, example: '#4f46e5' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'colorCalendario debe ser un color hex válido (#rrggbb)' })
  colorCalendario?: string;
}
