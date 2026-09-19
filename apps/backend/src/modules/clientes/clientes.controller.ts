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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination';
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

/**
 * Sin @Roles: crear/editar/ver clientes es trabajo operativo del día a
 * día (recepción/empleados), no una acción administrativa como en
 * Usuarios — cualquier rol autenticado del negocio puede usarlo.
 */
@ApiBearerAuth()
@ApiTags('clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  crear(@Body() dto: CrearClienteDto) {
    return this.clientesService.crear(dto);
  }

  @Get()
  listar(@Query() query: PaginationQueryDto) {
    return this.clientesService.listar(query);
  }

  @Get(':id')
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientesService.obtenerUno(id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarClienteDto) {
    return this.clientesService.actualizar(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientesService.desactivar(id);
  }
}
