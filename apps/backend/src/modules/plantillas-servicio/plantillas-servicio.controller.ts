import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { PlantillasServicioService } from './plantillas-servicio.service';
import { ListarPlantillasQueryDto } from './dto/listar-plantillas-query.dto';

/** Consumido por el paso de onboarding tras el registro (punto 2 del brief). */
@ApiBearerAuth()
@ApiTags('plantillas-servicio')
@ErroresEstandar()
@Controller('plantillas-servicio')
export class PlantillasServicioController {
  constructor(private readonly plantillasServicioService: PlantillasServicioService) {}

  @Get()
  @ApiOperation({
    summary: 'Catálogo estático de servicios sugeridos para un tipo de negocio (onboarding)',
  })
  listar(@Query() query: ListarPlantillasQueryDto) {
    return this.plantillasServicioService.listarPorTipoNegocio(query.tipoNegocio);
  }
}
