import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../../database/entities';
import { PaginationQueryDto } from '../../common/pagination';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { LimitePlan } from '../suscripciones/decorators/limite-plan.decorator';
import { LimitePlanGratisGuard } from '../suscripciones/guards/limite-plan-gratis.guard';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@ApiBearerAuth()
@ApiTags('usuarios')
@ErroresEstandar()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Roles(RolUsuario.ADMIN)
  @UseGuards(LimitePlanGratisGuard)
  @LimitePlan('usuarios')
  @Post()
  @ApiOperation({
    summary: 'Crea un empleado (solo admin, sujeto al límite de 1 usuario del Plan Gratis)',
  })
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los usuarios del negocio, paginado' })
  listar(@Query() query: PaginationQueryDto) {
    return this.usuariosService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un usuario por id' })
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.obtenerUno(id);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un usuario' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usuariosService.actualizar(id, dto);
  }

  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactiva un usuario (soft delete)' })
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.usuariosService.desactivar(id);
  }
}
