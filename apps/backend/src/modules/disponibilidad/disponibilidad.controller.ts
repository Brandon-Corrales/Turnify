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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
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
@ErroresEstandar()
@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidadService: DisponibilidadService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una franja de disponibilidad semanal para un usuario' })
  crear(@Body() dto: CrearDisponibilidadDto) {
    return this.disponibilidadService.crear(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista la disponibilidad del negocio (opcionalmente filtrada por usuario)',
  })
  listar(@Query('idUsuario') idUsuario?: string) {
    return this.disponibilidadService.listar(idUsuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una franja de disponibilidad por id' })
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.disponibilidadService.obtenerUno(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza una franja de disponibilidad' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarDisponibilidadDto) {
    return this.disponibilidadService.actualizar(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactiva una franja de disponibilidad' })
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.disponibilidadService.desactivar(id);
  }
}
