import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { MONEDAS_PERMITIDAS } from '../../../database/entities';
import { EsZonaHoraria } from '../../../common/validation/es-zona-horaria.validator';

export class ActualizarNegocioDto {
  @ApiProperty({ required: false, example: 'Barbería El Corte' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ required: false, example: 'barberia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tipoNegocio?: string;

  @ApiProperty({ required: false, example: '+506 8888-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ required: false, example: 'Nicoya, Guanacaste' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiProperty({
    required: false,
    example: 'America/Costa_Rica',
    description: 'Zona horaria IANA del negocio. Las fechas se siguen guardando en UTC.',
  })
  @IsOptional()
  @EsZonaHoraria()
  zonaHoraria?: string;

  @ApiProperty({
    required: false,
    example: 'CRC',
    enum: MONEDAS_PERMITIDAS,
    description:
      'Moneda ISO 4217 en la que se muestran los precios. No convierte los montos guardados.',
  })
  @IsOptional()
  @IsIn(MONEDAS_PERMITIDAS, { message: i18nValidationMessage('validacion.MONEDA_INVALIDA') })
  moneda?: string;
}
