import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegistroNegocioDto } from './dto/registro-negocio.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Límite más estricto que el global (60/min) para los endpoints públicos
  // más sensibles a fuerza bruta/abuso: registro, login y refresh.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('registro')
  registrar(@Body() dto: RegistroNegocioDto) {
    return this.authService.registrarNegocio(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refrescar(@Body() dto: RefreshTokenDto) {
    return this.authService.refrescar(dto.refreshToken);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() usuario: JwtPayload) {
    await this.authService.logout(usuario.sub);
  }

  /** Permite al frontend restaurar la sesión tras un refresh de página. */
  @ApiBearerAuth()
  @Get('me')
  obtenerPerfil(@CurrentUser() usuario: JwtPayload) {
    return this.authService.obtenerPerfil(usuario.sub);
  }
}
