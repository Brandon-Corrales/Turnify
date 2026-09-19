import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarNegocioDto {
  @ApiProperty({ required: false, example: 'Barbería El Corte' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ required: false, example: 'barberia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tipoNegocio?: string;

  @ApiProperty({ required: false, example: '+506 8888-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false, example: 'Nicoya, Guanacaste' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
}
