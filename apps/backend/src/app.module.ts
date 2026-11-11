import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import * as path from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { validateEnv, Env } from './config/env.schema';
import {
  avisoAmbienteBaseDatos,
  hostDeConexion,
  opcionesI18n,
  opcionesMigracionesAlArrancar,
} from './config/ambiente';
import { listaEntidades } from './database/entity-list';
import { construirOpcionesConexion } from './database/opciones-conexion';
import { HealthModule } from './health/health.module';
import { TenantModule } from './common/tenant';
import { RegistroSolicitudesMiddleware } from './common/logging/registro-solicitudes.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { NegociosModule } from './modules/negocios/negocios.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { DisponibilidadModule } from './modules/disponibilidad/disponibilidad.module';
import { ReservasModule } from './modules/reservas/reservas.module';
import { PlantillasServicioModule } from './modules/plantillas-servicio/plantillas-servicio.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { SuscripcionesModule } from './modules/suscripciones/suscripciones.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { ReservaPublicaModule } from './modules/reserva-publica/reserva-publica.module';
import { TiempoRealModule } from './modules/tiempo-real/tiempo-real.module';
import { AppThrottlerGuard } from './common/throttler/ws-aware-throttler.guard';

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
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        // SSL y validación opcional del certificado: ver opciones-conexion.ts.
        const conexion = construirOpcionesConexion({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USERNAME: config.get('DB_USERNAME', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
          DB_SSL_CA: config.get('DB_SSL_CA', { infer: true }),
          DB_SSL_CA_PATH: config.get('DB_SSL_CA_PATH', { infer: true }),
        });
        const aviso = avisoAmbienteBaseDatos(nodeEnv, hostDeConexion(conexion));
        if (aviso) new Logger('BaseDatos').warn(aviso);
        return {
          type: 'postgres' as const,
          ...conexion,
          entities: listaEntidades,
          synchronize: false,
          // Desactivado salvo MIGRATIONS_RUN_ON_START=true (ver config/ambiente.ts).
          ...opcionesMigracionesAlArrancar(
            config.get('MIGRATIONS_RUN_ON_START', { infer: true }),
            __dirname,
          ),
          logging: nodeEnv === 'development',
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
    // i18n backend (punto 10 del brief): mensajes de validación, errores
    // y notificaciones en ES/EN. Español por defecto (mercado objetivo es
    // Costa Rica); ?lang=en o el header Accept-Language cambian el
    // idioma de una request puntual — las notificaciones, en cambio,
    // siempre usan el idioma_preferido del CLIENTE (nunca el resolver de
    // la request), ver NotificacionesService.
    // `watch` (recargar los JSON al editarlos) solo en desarrollo: ver
    // config/ambiente.ts.
    I18nModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        opcionesI18n(config.get('NODE_ENV', { infer: true }), path.join(__dirname, 'i18n/')),
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
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
    SuscripcionesModule,
    ReportesModule,
    ChatbotModule,
    ReservaPublicaModule,
    // Sincronización en vivo del panel: avisa por WebSocket después de
    // cada escritura para que ninguna pantalla necesite refrescarse.
    TiempoRealModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RegistroSolicitudesMiddleware).forRoutes('*');
  }
}
