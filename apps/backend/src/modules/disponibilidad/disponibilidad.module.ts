import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Disponibilidad, Usuario } from '../../database/entities';
import { DisponibilidadController } from './disponibilidad.controller';
import { DisponibilidadService } from './disponibilidad.service';

@Module({
  imports: [TypeOrmModule.forFeature([Disponibilidad, Usuario])],
  controllers: [DisponibilidadController],
  providers: [DisponibilidadService, TenantRepositoryProvider(Disponibilidad), TenantRepositoryProvider(Usuario)],
})
export class DisponibilidadModule {}
