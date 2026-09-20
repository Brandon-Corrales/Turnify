import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Disponibilidad, Reserva, Usuario } from '../../database/entities';
import { NegociosModule } from '../negocios/negocios.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ReservasModule } from '../reservas/reservas.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { ReservaPublicaController } from './reserva-publica.controller';
import { ReservaPublicaService } from './reserva-publica.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Disponibilidad, Reserva]),
    NegociosModule,
    ServiciosModule,
    ClientesModule,
    ReservasModule,
    // Trae LimitesPlanService exportado, para replicar el chequeo del
    // Plan Gratis sin el guard (que depende de request.user, inexistente
    // en un endpoint público) — ver el comentario en el service.
    SuscripcionesModule,
  ],
  controllers: [ReservaPublicaController],
  providers: [
    ReservaPublicaService,
    TenantRepositoryProvider(Usuario),
    TenantRepositoryProvider(Disponibilidad),
    TenantRepositoryProvider(Reserva),
  ],
})
export class ReservaPublicaModule {}
