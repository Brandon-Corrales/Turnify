import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../../database/entities';
import { NegociosService } from './negocios.service';
import { ActualizarNegocioDto } from './dto/actualizar-negocio.dto';

@ApiBearerAuth()
@ApiTags('negocios')
@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Get('mi-negocio')
  obtenerMiNegocio() {
    return this.negociosService.obtenerMiNegocio();
  }

  @Roles(RolUsuario.ADMIN)
  @Patch('mi-negocio')
  actualizarMiNegocio(@Body() dto: ActualizarNegocioDto) {
    return this.negociosService.actualizarMiNegocio(dto);
  }

  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('mi-negocio')
  async desactivarMiNegocio() {
    await this.negociosService.desactivarMiNegocio();
  }
}
