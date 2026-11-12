import { EsTelefono, NormalizarTelefono } from '../../../common/validation/telefono.validator';
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

  @ApiProperty({
    required: false,
    example: '+50688883333',
    description: 'Se guarda en E.164. Sin prefijo "+", se interpreta como número de Costa Rica.',
  })
  @NormalizarTelefono()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @EsTelefono()
  telefono?: string;

  @ApiProperty({ required: false, example: 'Prefiere citas en la mañana' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
