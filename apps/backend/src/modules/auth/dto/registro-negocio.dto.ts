import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Política mínima de contraseña: 8+ caracteres, al menos una letra y un número. */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';

export class RegistroNegocioDto {
  @ApiProperty({ example: 'Barbería El Corte' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreNegocio!: string;

  @ApiProperty({ example: 'barberia' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tipoNegocio!: string;

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
  @IsString()
  @MinLength(8, { message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  contrasena!: string;
}
