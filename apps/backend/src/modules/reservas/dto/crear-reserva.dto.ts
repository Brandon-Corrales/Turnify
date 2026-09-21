import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrigenReserva } from '../../../database/entities';

export class CrearReservaDto {
  @ApiProperty()
  @IsUUID()
  idCliente!: string;

  @ApiProperty()
  @IsUUID()
  idServicio!: string;

  @ApiProperty({ description: 'Usuario (empleado) que atiende la cita' })
  @IsUUID()
  idUsuario!: string;

  @ApiProperty({
    example: '2026-10-01T15:00:00.000Z',
    description: 'Fecha/hora de inicio en ISO 8601',
  })
  @IsDateString()
  fechaHoraInicio!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiProperty({ required: false, enum: OrigenReserva, default: OrigenReserva.ADMIN })
  @IsOptional()
  @IsEnum(OrigenReserva)
  origen?: OrigenReserva;
}
