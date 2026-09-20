import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { ReporteQueryDto } from './dto/reporte-query.dto';

@ApiBearerAuth()
@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  resumen(@Query() query: ReporteQueryDto) {
    return this.reportesService.resumen(query.desde, query.hasta);
  }
}
