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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../../database/entities';
import { PaginationQueryDto } from '../../common/pagination';
import { LimitePlan } from '../suscripciones/decorators/limite-plan.decorator';
import { LimitePlanGratisGuard } from '../suscripciones/guards/limite-plan-gratis.guard';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@ApiBearerAuth()
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Roles(RolUsuario.ADMIN)
  @UseGuards(LimitePlanGratisGuard)
  @LimitePlan('usuarios')
  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Get()
  listar(@Query() query: PaginationQueryDto) {
    return this.usuariosService.listar(query);
  }

  @Get(':id')
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.obtenerUno(id);
  }

  @Roles(RolUsuario.ADMIN)
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usuariosService.actualizar(id, dto);
  }

  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.usuariosService.desactivar(id);
  }
}
