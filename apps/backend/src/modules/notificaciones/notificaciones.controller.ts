import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErroresEstandar } from '../../common/swagger/errores-estandar.decorator';
import { PaginationQueryDto } from '../../common/pagination';
import { TenantContextService } from '../../common/tenant';
import { NotificacionesService } from './notificaciones.service';

@ApiBearerAuth()
@ApiTags('notificaciones')
@ErroresEstandar()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Historial de notificaciones del negocio (confirmaciones, cancelaciones, recordatorios)',
  })
  listar(@Query() query: PaginationQueryDto) {
    return this.notificacionesService.listar(this.tenantContext.idNegocio, query);
  }
}
