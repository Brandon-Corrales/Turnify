import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Not } from 'typeorm';
import { InjectTenantRepository, TenantScopedRepository } from '../../common/tenant';
import { PaginatedResult, PaginationQueryDto } from '../../common/pagination';
import { RolUsuario, Usuario } from '../../database/entities';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

interface UsuarioPublico {
  idUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rol: RolUsuario;
  telefono?: string;
  activo: boolean;
  creadoEn: Date;
}

const BCRYPT_ROUNDS = 10;
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectTenantRepository(Usuario) private readonly usuarioRepo: TenantScopedRepository<Usuario>,
  ) {}

  async crear(dto: CrearUsuarioDto): Promise<UsuarioPublico> {
    const contrasenaHash = await bcrypt.hash(dto.contrasena, BCRYPT_ROUNDS);
    try {
      const usuario = await this.usuarioRepo.save(
        this.usuarioRepo.create({
          nombreCompleto: dto.nombreCompleto,
          correoElectronico: dto.correoElectronico,
          contrasenaHash,
          rol: dto.rol,
          telefono: dto.telefono,
          activo: true,
        }),
      );
      this.logger.log(`Usuario ${usuario.idUsuario} creado con rol ${usuario.rol}`);
      return this.aPublico(usuario);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          errorCode: 'EMAIL_YA_REGISTRADO',
          message: 'Ya existe un usuario con ese correo en este negocio',
        });
      }
      throw err;
    }
  }

  async listar(query: PaginationQueryDto): Promise<PaginatedResult<UsuarioPublico>> {
    const { page, limit } = query;
    const [usuarios, total] = await this.usuarioRepo.findAndCount({
      order: { creadoEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: usuarios.map((u) => this.aPublico(u)), total, page, limit };
  }

  async obtenerUno(idUsuario: string): Promise<UsuarioPublico> {
    return this.aPublico(await this.buscarOFallar(idUsuario));
  }

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<UsuarioPublico> {
    const usuario = await this.buscarOFallar(idUsuario);

    const dejaDeSerAdmin = usuario.rol === RolUsuario.ADMIN && dto.rol && dto.rol !== RolUsuario.ADMIN;
    if (dejaDeSerAdmin) {
      await this.asegurarNoEsUltimoAdmin(idUsuario, 'No puedes cambiar el rol del último administrador del negocio');
    }

    await this.usuarioRepo.update({ idUsuario } as any, dto as any);
    this.logger.log(`Usuario ${idUsuario} actualizado`);
    return this.aPublico(await this.buscarOFallar(idUsuario));
  }

  async desactivar(idUsuario: string): Promise<void> {
    const usuario = await this.buscarOFallar(idUsuario);

    if (usuario.rol === RolUsuario.ADMIN) {
      await this.asegurarNoEsUltimoAdmin(idUsuario, 'No puedes desactivar al último administrador del negocio');
    }

    await this.usuarioRepo.update({ idUsuario } as any, { activo: false, refreshTokenHash: null } as any);
    await this.usuarioRepo.softDelete({ idUsuario } as any);
    this.logger.log(`Usuario ${idUsuario} desactivado`);
  }

  /** Evita dejar un negocio sin ningún admin activo al desactivar/degradar al último. */
  private async asegurarNoEsUltimoAdmin(idUsuarioExcluido: string, mensaje: string): Promise<void> {
    const otrosAdminsActivos = await this.usuarioRepo.count({
      where: { rol: RolUsuario.ADMIN, activo: true, idUsuario: Not(idUsuarioExcluido) } as any,
    });
    if (otrosAdminsActivos === 0) {
      throw new ConflictException({ errorCode: 'ULTIMO_ADMIN_REQUERIDO', message: mensaje });
    }
  }

  private async buscarOFallar(idUsuario: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { idUsuario } as any });
    if (!usuario) {
      throw new NotFoundException({ errorCode: 'USUARIO_NO_ENCONTRADO', message: 'Usuario no encontrado' });
    }
    return usuario;
  }

  private aPublico(usuario: Usuario): UsuarioPublico {
    return {
      idUsuario: usuario.idUsuario,
      nombreCompleto: usuario.nombreCompleto,
      correoElectronico: usuario.correoElectronico,
      rol: usuario.rol,
      telefono: usuario.telefono,
      activo: usuario.activo,
      creadoEn: usuario.creadoEn,
    };
  }
}
