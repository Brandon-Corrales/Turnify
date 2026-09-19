import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearServicioDto {
  @ApiProperty({ example: 'Corte clásico' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ required: false, example: 'Corte de cabello tradicional' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 30, description: 'Duración en minutos' })
  @IsInt()
  @Min(1)
  @Max(1440) // tope de un día completo, evita valores absurdos por error de captura
  duracionMinutos!: number;

  @ApiProperty({ example: 8000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precio!: number;

  @ApiProperty({ required: false, example: '#4f46e5', description: 'Color hex para FullCalendar' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'colorCalendario debe ser un color hex válido (#rrggbb)',
  })
  colorCalendario?: string;
}
