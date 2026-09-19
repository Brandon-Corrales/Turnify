import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from '../../database/entities';
import { NotificacionesService } from './notificaciones.service';
import { ResendService } from './providers/resend.service';
import { WhatsappCloudApiService } from './providers/whatsapp-cloud-api.service';

/**
 * Notificacion no tiene id_negocio (no es dato de un tenant directo, se
 * deriva de id_reserva/id_cliente) y el worker debe poder procesar
 * pendientes de TODOS los negocios en cada corrida del cron — por eso usa
 * un Repository normal, no TenantScopedRepository (que exige la columna).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  providers: [NotificacionesService, ResendService, WhatsappCloudApiService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
