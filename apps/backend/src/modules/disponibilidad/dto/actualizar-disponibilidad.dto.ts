import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const HORA_MENSAJE = 'Formato de hora inválido, debe ser HH:mm (24 horas)';

/** No incluye idUsuario: reasignar el horario a otro empleado se hace borrando y creando uno nuevo. */
export class ActualizarDisponibilidadDto {
  @ApiProperty({ required: false, example: 1, minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @ApiProperty({ required: false, example: '09:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: HORA_MENSAJE })
  horaInicio?: string;

  @ApiProperty({ required: false, example: '17:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: HORA_MENSAJE })
  horaFin?: string;

  /**
   * Permite reactivar un día apagado con `DELETE /disponibilidad/:id`
   * (que solo pone `activo:false`, ver `desactivar()`) sin tener que
   * borrar y recrear la franja completa — necesario para la pantalla de
   * Configuración de horario laboral (un toggle por día debe poder
   * prenderse de nuevo).
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
