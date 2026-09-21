import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ReprogramarReservaDto {
  @ApiProperty({ example: '2026-10-02T15:00:00.000Z' })
  @IsDateString()
  fechaHoraInicio!: string;
}
