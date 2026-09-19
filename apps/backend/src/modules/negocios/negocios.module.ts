import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from '../../database/entities';
import { NegociosController } from './negocios.controller';
import { NegociosService } from './negocios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio])],
  controllers: [NegociosController],
  providers: [NegociosService],
})
export class NegociosModule {}
