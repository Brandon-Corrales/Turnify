import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Globales: toda ruta requiere JWT válido salvo @Public(); RolesGuard
    // solo restringe si el handler tiene @Roles(...). Mismo patrón
    // transversal que usará el guard multi-tenant (tarjeta siguiente).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
