import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantRepositoryProvider } from '../../common/tenant';
import { Cliente, Negocio } from '../../database/entities';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrivilegiosClienteService } from './privilegios-cliente.service';
import { PrivilegioClienteGuard } from './guards/privilegio-cliente.guard';

@Module({
  // Negocio también registrado aquí (Repository plano, no
  // TenantScopedRepository): PrivilegiosClienteService necesita leer
  // planSuscripcion del negocio, dato que no pertenece al propio negocio
  // como tenant sino que ES el tenant — mismo caso ya documentado en
  // NegociosService.
  imports: [TypeOrmModule.forFeature([Cliente, Negocio])],
  controllers: [ClientesController],
  providers: [
    ClientesService,
    TenantRepositoryProvider(Cliente),
    PrivilegiosClienteService,
    PrivilegioClienteGuard,
  ],
})
export class ClientesModule {}
