import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Servicio } from '../../database/entities';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { ServiciosController } from './servicios.controller';
import { ServiciosService } from './servicios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Servicio]), SuscripcionesModule],
  controllers: [ServiciosController],
  providers: [ServiciosService, TenantRepositoryProvider(Servicio)],
})
export class ServiciosModule {}
