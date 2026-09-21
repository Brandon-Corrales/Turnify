import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class HorariosPublicosQueryDto {
  @ApiProperty({ description: 'Servicio para el que se buscan horarios disponibles' })
  @IsUUID()
  idServicio!: string;

  @ApiProperty({ example: '2026-09-25', description: 'Día calendario en hora local de Costa Rica' })
  @IsDateString({ strict: true })
  fecha!: string;
}
