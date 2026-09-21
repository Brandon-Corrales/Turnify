import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { ReportesService } from './reportes.service';
import { ReporteQueryDto } from './dto/reporte-query.dto';

@ApiBearerAuth()
@ApiTags('reportes')
@ErroresEstandar()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Resumen agregado del negocio en un rango de fechas',
    description:
      'Reservas por estado, reservas por día e ingresos estimados (proyección desde el catálogo de precios, no cobro real por reserva).',
  })
  resumen(@Query() query: ReporteQueryDto) {
    return this.reportesService.resumen(query.desde, query.hasta);
  }
}
