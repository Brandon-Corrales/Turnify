import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { ReservaPublicaService } from './reserva-publica.service';
import { HorariosPublicosQueryDto } from './dto/horarios-publicos-query.dto';
import { CrearReservaPublicaDto } from './dto/crear-reserva-publica.dto';

/**
 * Endpoints sin sesión para el wizard de reserva pública (punto 6 del
 * brief): el visitante nunca tiene un JWT, así que TODA esta superficie
 * es @Public() y recibe `idNegocio` explícito en la URL — nunca del
 * contexto multi-tenant de una request autenticada, que aquí no existe.
 */
@Public()
@ApiTags('reserva-publica')
@ErroresEstandar()
@Controller('publico/negocios/:idNegocio')
export class ReservaPublicaController {
  constructor(private readonly reservaPublica: ReservaPublicaService) {}

  @Get()
  @ApiOperation({ summary: 'Datos públicos mínimos del negocio (nombre, tipo) para el wizard' })
  obtenerNegocio(@Param('idNegocio', ParseUUIDPipe) idNegocio: string) {
    return this.reservaPublica.obtenerNegocio(idNegocio);
  }

  @Get('servicios')
  @ApiOperation({ summary: 'Servicios activos del negocio (paso 1 del wizard)' })
  listarServicios(@Param('idNegocio', ParseUUIDPipe) idNegocio: string) {
    return this.reservaPublica.listarServicios(idNegocio);
  }

  @Get('horarios')
  @ApiOperation({
    summary: 'Horarios disponibles de un servicio en un día dado (paso 2 del wizard)',
  })
  listarHorarios(
    @Param('idNegocio', ParseUUIDPipe) idNegocio: string,
    @Query() query: HorariosPublicosQueryDto,
  ) {
    return this.reservaPublica.listarHorarios(idNegocio, query.idServicio, query.fecha);
  }

  // Límite propio y más estricto que el global (60/min): un endpoint
  // público de escritura sin autenticación es el blanco más obvio de
  // abuso (punto 15 del brief lo pide explícito para "el endpoint de
  // reserva pública").
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reservas')
  @ApiOperation({
    summary:
      'Crea la reserva con los datos del cliente (paso 4 del wizard) — sujeta al límite de 20/mes del Plan Gratis',
  })
  crearReserva(
    @Param('idNegocio', ParseUUIDPipe) idNegocio: string,
    @Body() dto: CrearReservaPublicaDto,
  ) {
    return this.reservaPublica.crearReserva(idNegocio, dto);
  }
}
