import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TerminosPermitidos } from '../../../common/validation/terminos-permitidos.validator';

export class MensajeChatbotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @TerminosPermitidos()
  pregunta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pantallaActual?: string;
}
