import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RolUsuario } from '../../../database/entities';
import { EsContrasenaValida } from '../../../common/validation/es-contrasena-valida.decorator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'Carlos Empleado' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompleto!: string;

  @ApiProperty({ example: 'carlos@elcorte.com' })
  @IsEmail()
  correoElectronico!: string;

  @ApiProperty({ example: 'Turnify123' })
  @EsContrasenaValida()
  contrasena!: string;

  @ApiProperty({ enum: RolUsuario, example: RolUsuario.EMPLEADO })
  @IsEnum(RolUsuario)
  rol!: RolUsuario;

  @ApiProperty({ required: false, example: '+506 8888-0002' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
