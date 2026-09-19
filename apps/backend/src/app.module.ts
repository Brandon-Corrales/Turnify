import { Module } from '@nestjs/common';
import * as path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv, Env } from './config/env.schema';
import * as entities from './database/entities';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { NegociosModule } from './modules/negocios/negocios.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { DisponibilidadModule } from './modules/disponibilidad/disponibilidad.module';
import { ReservasModule } from './modules/reservas/reservas.module';

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
            ? { url: databaseUrl }
            : {
                host: config.get('DB_HOST', { infer: true }),
                port: config.get('DB_PORT', { infer: true }),
                username: config.get('DB_USERNAME', { infer: true }),
                password: config.get('DB_PASSWORD', { infer: true }),
                database: config.get('DB_NAME', { infer: true }),
              }),
          entities: Object.values(entities).filter((value) => typeof value === 'function'),
          synchronize: false,
          logging: config.get('NODE_ENV', { infer: true }) === 'development',
        };
      },
    }),
    HealthModule,
    AuthModule,
    NegociosModule,
    UsuariosModule,
    ClientesModule,
    ServiciosModule,
    DisponibilidadModule,
    ReservasModule,
  ],
})
export class AppModule {}
