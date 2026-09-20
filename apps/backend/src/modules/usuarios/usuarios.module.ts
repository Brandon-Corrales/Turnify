import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Usuario } from '../../database/entities';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), SuscripcionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, TenantRepositoryProvider(Usuario)],
})
export class UsuariosModule {}
