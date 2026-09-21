import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class MensajeChatbotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  pregunta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pantallaActual?: string;
}
