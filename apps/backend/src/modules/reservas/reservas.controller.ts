import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { LimitePlan } from '../suscripciones/decorators/limite-plan.decorator';
import { LimitePlanGratisGuard } from '../suscripciones/guards/limite-plan-gratis.guard';
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
@ErroresEstandar()
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @UseGuards(LimitePlanGratisGuard)
  @LimitePlan('reservas')
  @Post()
  @ApiOperation({
    summary:
      'Crea una reserva (valida disponibilidad y traslapes; sujeto al límite de 20/mes del Plan Gratis)',
  })
  crear(@Body() dto: CrearReservaDto) {
    return this.reservasService.crear(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista reservas del negocio, filtrable por rango de fechas/usuario/cliente/estado',
  })
  listar(@Query() query: ListarReservasQueryDto) {
    return this.reservasService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una reserva por id' })
  obtenerUna(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservasService.obtenerUna(id);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancela una reserva (dispara la notificación de cancelación)' })
  cancelar(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservasService.cancelar(id);
  }

  @Patch(':id/reprogramar')
  @ApiOperation({
    summary: 'Cambia el horario de una reserva (valida disponibilidad y traslapes de nuevo)',
  })
  reprogramar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReprogramarReservaDto) {
    return this.reservasService.reprogramar(id, dto);
  }
}
