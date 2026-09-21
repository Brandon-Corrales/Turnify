import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const HORA_MENSAJE = 'Formato de hora inválido, debe ser HH:mm (24 horas)';

export class CrearDisponibilidadDto {
  @ApiProperty({ description: 'Usuario (empleado) al que pertenece este horario' })
  @IsUUID()
  idUsuario!: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0 = domingo … 6 = sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  @ApiProperty({ example: '09:00' })
  @Matches(HORA_REGEX, { message: HORA_MENSAJE })
  horaInicio!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(HORA_REGEX, { message: HORA_MENSAJE })
  horaFin!: string;
}
