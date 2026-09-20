import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectTenantRepository, TenantScopedRepository } from '../../common/tenant';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import { Cliente } from '../../database/entities';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    @InjectTenantRepository(Cliente) private readonly clienteRepo: TenantScopedRepository<Cliente>,
  ) {}

  async crear(dto: CrearClienteDto): Promise<Cliente> {
    try {
      const cliente = await this.clienteRepo.save(this.clienteRepo.create(dto));
      this.logger.log(`Cliente ${cliente.idCliente} creado`);
      return cliente;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          errorCode: 'CLIENTE_CORREO_YA_REGISTRADO',
          message: 'Ya existe un cliente con ese correo en este negocio',
        });
      }
      throw err;
    }
  }

  /** Usado por el wizard de reserva pública para no duplicar un cliente que ya escribió a este negocio antes (find-or-create por correo, sin exponer el resto del CRUD de Clientes a un visitante anónimo). */
  async buscarPorCorreo(correoElectronico: string): Promise<Cliente | null> {
    return this.clienteRepo.findOne({ where: { correoElectronico } as any });
  }

  async listar(query: PaginationQueryDto): Promise<PaginatedResult<Cliente>> {
    const { page, limit } = query;
    const [clientes, total] = await this.clienteRepo.findAndCount({
      order: { creadoEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: clientes, total, page, limit };
  }

  async obtenerUno(idCliente: string): Promise<Cliente> {
    return this.buscarOFallar(idCliente);
  }

  async actualizar(idCliente: string, dto: ActualizarClienteDto): Promise<Cliente> {
    await this.buscarOFallar(idCliente);
    try {
      await this.clienteRepo.update({ idCliente } as any, dto as any);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          errorCode: 'CLIENTE_CORREO_YA_REGISTRADO',
          message: 'Ya existe un cliente con ese correo en este negocio',
        });
      }
      throw err;
    }
    this.logger.log(`Cliente ${idCliente} actualizado`);
    return this.buscarOFallar(idCliente);
  }

  async desactivar(idCliente: string): Promise<void> {
    await this.buscarOFallar(idCliente);
    await this.clienteRepo.update({ idCliente } as any, { activo: false } as any);
    await this.clienteRepo.softDelete({ idCliente } as any);
    this.logger.log(`Cliente ${idCliente} desactivado`);
  }

  private async buscarOFallar(idCliente: string): Promise<Cliente> {
    const cliente = await this.clienteRepo.findOne({ where: { idCliente } as any });
    if (!cliente) {
      throw new NotFoundException({
        errorCode: 'CLIENTE_NO_ENCONTRADO',
        message: 'Cliente no encontrado',
      });
    }
    return cliente;
  }
}
