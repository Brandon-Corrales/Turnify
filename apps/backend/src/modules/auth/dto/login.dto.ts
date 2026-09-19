import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana@elcorte.com' })
  @IsEmail()
  correoElectronico!: string;

  @ApiProperty({ example: 'Turnify123' })
  @IsString()
  @IsNotEmpty()
  contrasena!: string;
}
