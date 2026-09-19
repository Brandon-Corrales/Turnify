import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CanalPreferido, Idioma, NivelCliente } from '../../../database/entities';

export class CrearClienteDto {
  @ApiProperty({ example: 'María Rodríguez' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompleto!: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  correoElectronico!: string;

  @ApiProperty({ required: false, example: '+506 8888-3333' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false, example: 'Prefiere citas en la mañana' })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiProperty({ required: false, enum: CanalPreferido, default: CanalPreferido.EMAIL })
  @IsOptional()
  @IsEnum(CanalPreferido)
  canalPreferido?: CanalPreferido;

  @ApiProperty({ required: false, enum: Idioma, default: Idioma.ES })
  @IsOptional()
  @IsEnum(Idioma)
  idiomaPreferido?: Idioma;

  @ApiProperty({ required: false, enum: NivelCliente, default: NivelCliente.GRATIS })
  @IsOptional()
  @IsEnum(NivelCliente)
  nivelCliente?: NivelCliente;
}
