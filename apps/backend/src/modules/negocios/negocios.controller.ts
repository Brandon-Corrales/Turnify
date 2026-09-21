import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../../database/entities';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { NegociosService } from './negocios.service';
import { ActualizarNegocioDto } from './dto/actualizar-negocio.dto';

@ApiBearerAuth()
@ApiTags('negocios')
@ErroresEstandar()
@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Get('mi-negocio')
  @ApiOperation({ summary: 'Perfil del negocio del usuario autenticado' })
  obtenerMiNegocio() {
    return this.negociosService.obtenerMiNegocio();
  }

  @Roles(RolUsuario.ADMIN)
  @Patch('mi-negocio')
  @ApiOperation({ summary: 'Actualiza el perfil del propio negocio' })
  actualizarMiNegocio(@Body() dto: ActualizarNegocioDto) {
    return this.negociosService.actualizarMiNegocio(dto);
  }

  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('mi-negocio')
  @ApiOperation({ summary: 'Desactiva el propio negocio (soft delete)' })
  async desactivarMiNegocio() {
    await this.negociosService.desactivarMiNegocio();
  }
}
