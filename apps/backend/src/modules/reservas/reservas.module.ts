import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Cliente, Disponibilidad, Reserva, Servicio, Usuario } from '../../database/entities';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserva, Cliente, Servicio, Usuario, Disponibilidad]),
    NotificacionesModule,
    SuscripcionesModule,
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
  // Exportado para que ChatbotModule reutilice el service (punto 16 del
  // brief: nunca consultar la BD directo desde el chatbot).
  exports: [ReservasService],
})
export class ReservasModule {}
