import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DatosClientePublicoDto {
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
}

export class CrearReservaPublicaDto {
  @ApiProperty()
  @IsUUID()
  idServicio!: string;

  @ApiProperty({ example: '2026-09-25T15:00:00.000Z' })
  @IsDateString()
  fechaHoraInicio!: string;

  @ApiProperty({ type: DatosClientePublicoDto })
  @ValidateNested()
  @Type(() => DatosClientePublicoDto)
  cliente!: DatosClientePublicoDto;
}
