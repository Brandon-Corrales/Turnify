import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Reserva } from '../../database/entities';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reserva])],
  controllers: [ReportesController],
  providers: [ReportesService, TenantRepositoryProvider(Reserva)],
})
export class ReportesModule {}
