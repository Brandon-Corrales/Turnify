import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CanalPreferido, Idioma, NivelCliente } from '../../../database/entities';

export class ActualizarClienteDto {
  @ApiProperty({ required: false, example: 'María Rodríguez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompleto?: string;

  @ApiProperty({ required: false, example: 'maria@example.com' })
  @IsOptional()
  @IsEmail()
  correoElectronico?: string;

  @ApiProperty({ required: false, example: '+506 8888-3333' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiProperty({ required: false, enum: CanalPreferido })
  @IsOptional()
  @IsEnum(CanalPreferido)
  canalPreferido?: CanalPreferido;

  @ApiProperty({ required: false, enum: Idioma })
  @IsOptional()
  @IsEnum(Idioma)
  idiomaPreferido?: Idioma;

  @ApiProperty({ required: false, enum: NivelCliente })
  @IsOptional()
  @IsEnum(NivelCliente)
  nivelCliente?: NivelCliente;
}
