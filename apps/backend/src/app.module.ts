import { Module } from '@nestjs/common';
import * as path from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv, Env } from './config/env.schema';
import { listaEntidades } from './database/entity-list';
import { HealthModule } from './health/health.module';
import { TenantModule } from './common/tenant';
import { AuthModule } from './modules/auth/auth.module';
import { NegociosModule } from './modules/negocios/negocios.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { DisponibilidadModule } from './modules/disponibilidad/disponibilidad.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { PlantillasServicioModule } from './modules/plantillas-servicio/plantillas-servicio.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El monorepo mantiene un único .env en la raíz (compartido con
      // docker-compose y con el CLI de TypeORM en database/data-source.ts).
      envFilePath: path.resolve(__dirname, '../../../.env'),
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const databaseUrl = config.get('DATABASE_URL', { infer: true });
        return {
          type: 'postgres' as const,
          ...(databaseUrl
            ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
            : {
                host: config.get('DB_HOST', { infer: true }),
                port: config.get('DB_PORT', { infer: true }),
                username: config.get('DB_USERNAME', { infer: true }),
                password: config.get('DB_PASSWORD', { infer: true }),
                database: config.get('DB_NAME', { infer: true }),
              }),
          entities: listaEntidades,
          synchronize: false,
          logging: config.get('NODE_ENV', { infer: true }) === 'development',
        };
      },
    }),
    // Límite global por IP (punto 15 del brief); los endpoints públicos
    // sensibles a fuerza bruta (login/registro/refresh) se sobrescriben con
    // un límite más estricto vía @Throttle en su propio controller.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      errorMessage: 'Demasiadas solicitudes. Espera un minuto e intenta de nuevo.',
    }),
    // Habilita @Cron en cualquier provider del árbol de módulos — el
    // worker de Notificaciones lo usa para revisar pendientes cada minuto.
    ScheduleModule.forRoot(),
    HealthModule,
    TenantModule,
    AuthModule,
    NegociosModule,
    UsuariosModule,
    ClientesModule,
    ServiciosModule,
    DisponibilidadModule,
    ReservasModule,
    PlantillasServicioModule,
    NotificacionesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
