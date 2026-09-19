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
import { DisponibilidadService } from './disponibilidad.service';
import { CrearDisponibilidadDto } from './dto/crear-disponibilidad.dto';
import { ActualizarDisponibilidadDto } from './dto/actualizar-disponibilidad.dto';

/**
 * Sin @Roles a nivel de endpoint: la autorización real (admin gestiona a
 * cualquiera, empleado solo a sí mismo) depende del idUsuario objetivo,
 * no solo del rol del caller — se resuelve dentro del servicio.
 */
@ApiBearerAuth()
@ApiTags('disponibilidad')
@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidadService: DisponibilidadService) {}

  @Post()
  crear(@Body() dto: CrearDisponibilidadDto) {
    return this.disponibilidadService.crear(dto);
  }

  @Get()
  listar(@Query('idUsuario') idUsuario?: string) {
    return this.disponibilidadService.listar(idUsuario);
  }

  @Get(':id')
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.disponibilidadService.obtenerUno(id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarDisponibilidadDto) {
    return this.disponibilidadService.actualizar(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.disponibilidadService.desactivar(id);
  }
}
