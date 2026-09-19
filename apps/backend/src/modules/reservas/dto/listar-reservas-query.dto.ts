import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination';
import { EstadoReserva } from '../../../database/entities';

/**
 * `desde`/`hasta` filtran por fecha_hora_inicio — pensado para que el
 * calendario (FullCalendar) pida solo el rango de fechas visible, en vez
 * de traer todas las reservas del negocio.
 */
export class ListarReservasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idUsuario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idCliente?: string;

  @ApiPropertyOptional({ enum: EstadoReserva })
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
