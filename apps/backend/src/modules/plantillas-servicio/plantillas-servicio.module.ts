import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlantillaServicio } from '../../database/entities';
import { PlantillasServicioController } from './plantillas-servicio.controller';
import { PlantillasServicioService } from './plantillas-servicio.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlantillaServicio])],
  controllers: [PlantillasServicioController],
  providers: [PlantillasServicioService],
})
export class PlantillasServicioModule {}
