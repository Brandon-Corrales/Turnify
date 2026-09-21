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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { LimitePlan } from '../suscripciones/decorators/limite-plan.decorator';
import { LimitePlanGratisGuard } from '../suscripciones/guards/limite-plan-gratis.guard';
import { ServiciosService } from './servicios.service';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';

/**
 * Sin @Roles: definir/editar el catálogo de servicios es operativo, igual
 * que Clientes — cualquier rol autenticado del negocio puede usarlo.
 */
@ApiBearerAuth()
@ApiTags('servicios')
@ErroresEstandar()
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @UseGuards(LimitePlanGratisGuard)
  @LimitePlan('servicios')
  @Post()
  @ApiOperation({
    summary: 'Crea un servicio (sujeto al límite de 3 servicios activos del Plan Gratis)',
  })
  crear(@Body() dto: CrearServicioDto) {
    return this.serviciosService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los servicios del negocio, paginado' })
  listar(@Query() query: PaginationQueryDto) {
    return this.serviciosService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un servicio por id' })
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviciosService.obtenerUno(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un servicio' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarServicioDto) {
    return this.serviciosService.actualizar(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @ApiOperation({ summary: 'Desactiva un servicio (soft delete)' })
  async desactivar(@Param('id', ParseUUIDPipe) id: string) {
    await this.serviciosService.desactivar(id);
  }
}
