import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
import { ListarReservasQueryDto } from './dto/listar-reservas-query.dto';

/**
 * Endpoints para uso autenticado del staff (calendario interno). El
 * flujo de reserva pública sin autenticar (wizard de 4 pasos) es una
 * tarjeta de frontend de después del Seguimiento #2 y necesitará su
 * propio endpoint público — no reutiliza este controller tal cual.
 *
 * Sin DELETE: una reserva nunca se borra físicamente (es el historial que
 * justifica el soft-delete del resto de entidades) — "cancelar" es la
 * única baja posible, vía PATCH.
 */
@ApiBearerAuth()
@ApiTags('reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  crear(@Body() dto: CrearReservaDto) {
    return this.reservasService.crear(dto);
  }

  @Get()
  listar(@Query() query: ListarReservasQueryDto) {
    return this.reservasService.listar(query);
  }

  @Get(':id')
  obtenerUna(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservasService.obtenerUna(id);
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservasService.cancelar(id);
  }

  @Patch(':id/reprogramar')
  reprogramar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReprogramarReservaDto) {
    return this.reservasService.reprogramar(id, dto);
  }
}
