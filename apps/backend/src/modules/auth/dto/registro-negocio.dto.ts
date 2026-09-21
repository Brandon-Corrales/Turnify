import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EsContrasenaValida } from '../../../common/validation/es-contrasena-valida.decorator';
import { TipoNegocio } from '../../../database/entities';

export class RegistroNegocioDto {
  @ApiProperty({ example: 'Barbería El Corte' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreNegocio!: string;

  @ApiProperty({ example: TipoNegocio.BARBERIA, enum: TipoNegocio })
  @IsEnum(TipoNegocio, {
    message: `tipoNegocio debe ser uno de: ${Object.values(TipoNegocio).join(', ')}`,
  })
  tipoNegocio!: TipoNegocio;

  @ApiProperty({ example: 'contacto@elcorte.com' })
  @IsEmail()
  correoNegocio!: string;

  @ApiProperty({ required: false, example: '+506 8888-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefonoNegocio?: string;

  @ApiProperty({ required: false, example: 'Nicoya, Guanacaste' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccionNegocio?: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompletoAdmin!: string;

  @ApiProperty({ example: 'ana@elcorte.com' })
  @IsEmail()
  correoAdmin!: string;

  @ApiProperty({ example: 'Turnify123' })
  @EsContrasenaValida()
  contrasena!: string;
}
