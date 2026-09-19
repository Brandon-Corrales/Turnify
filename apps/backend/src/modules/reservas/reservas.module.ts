import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Cliente, Disponibilidad, Reserva, Servicio, Usuario } from '../../database/entities';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserva, Cliente, Servicio, Usuario, Disponibilidad]),
    NotificacionesModule,
  ],
  controllers: [ReservasController],
  providers: [
    ReservasService,
    TenantRepositoryProvider(Reserva),
    TenantRepositoryProvider(Cliente),
    TenantRepositoryProvider(Servicio),
    TenantRepositoryProvider(Usuario),
    TenantRepositoryProvider(Disponibilidad),
  ],
})
export class ReservasModule {}
