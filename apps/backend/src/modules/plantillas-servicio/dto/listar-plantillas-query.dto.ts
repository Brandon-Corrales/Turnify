import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TipoNegocio } from '../../../database/entities';

export class ListarPlantillasQueryDto {
  @ApiProperty({ enum: TipoNegocio })
  @IsEnum(TipoNegocio)
  tipoNegocio!: TipoNegocio;
}
