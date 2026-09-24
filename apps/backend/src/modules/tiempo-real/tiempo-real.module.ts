import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CambiosInterceptor } from './cambios.interceptor';
import { TiempoRealGateway } from './tiempo-real.gateway';

@Module({
  imports: [
    JwtModule.register({}), // el gateway verifica con el secreto leído de ConfigService, igual que WsJwtGuard
  ],
  providers: [TiempoRealGateway, { provide: APP_INTERCEPTOR, useClass: CambiosInterceptor }],
})
export class TiempoRealModule {}
