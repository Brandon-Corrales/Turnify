import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlantillasServicioService } from './plantillas-servicio.service';
import { ListarPlantillasQueryDto } from './dto/listar-plantillas-query.dto';

/** Consumido por el paso de onboarding tras el registro (punto 2 del brief). */
@ApiBearerAuth()
@ApiTags('plantillas-servicio')
@Controller('plantillas-servicio')
export class PlantillasServicioController {
  constructor(private readonly plantillasServicioService: PlantillasServicioService) {}

  @Get()
  listar(@Query() query: ListarPlantillasQueryDto) {
    return this.plantillasServicioService.listarPorTipoNegocio(query.tipoNegocio);
  }
}
