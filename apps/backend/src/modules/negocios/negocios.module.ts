import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from '../../database/entities';
import { NegociosController } from './negocios.controller';
import { NegociosService } from './negocios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio])],
  controllers: [NegociosController],
  providers: [NegociosService],
  // Exportado para que ChatbotModule reutilice el service (punto 16 del
  // brief: nunca consultar la BD directo desde el chatbot).
  exports: [NegociosService],
})
export class NegociosModule {}
