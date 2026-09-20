import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class IniciarCheckoutDto {
  @ApiProperty({ example: 'http://localhost:5173/suscripcion/exito' })
  @IsUrl({ require_tld: false })
  successUrl!: string;

  @ApiProperty({ example: 'http://localhost:5173/suscripcion/cancelada' })
  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
