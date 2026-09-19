import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Env } from '../../config/env.schema';
import {
  EstadoSuscripcion,
  Negocio,
  PlanSuscripcion,
  RolUsuario,
  Suscripcion,
  Usuario,
} from '../../database/entities';
import { RegistroNegocioDto } from './dto/registro-negocio.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface UsuarioPublico {
  idUsuario: string;
  idNegocio: string;
  nombreCompleto: string;
  correoElectronico: string;
  rol: RolUsuario;
}

const BCRYPT_ROUNDS = 10;
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';

/**
 * Los refresh tokens se guardan como SHA-256, NO bcrypt: bcrypt trunca su
 * entrada a 72 bytes, y como todos los refresh tokens de un mismo usuario
 * comparten un prefijo (mismo sub/idNegocio/rol) más largo que eso,
 * bcrypt.compare() los trataba como idénticos entre sí — rompiendo por
 * completo la detección de reuso. Un refresh token ya es de alta entropía
 * (firmado con HMAC), así que no necesita el salteo lento de bcrypt, solo
 * una huella íntegra y de largo fijo.
 */
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const tokensCoinciden = (candidatoHash: string, almacenadoHash: string): boolean => {
  const a = Buffer.from(candidatoHash, 'hex');
  const b = Buffer.from(almacenadoHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async registrarNegocio(
    dto: RegistroNegocioDto,
  ): Promise<{ usuario: UsuarioPublico; tokens: TokenPair }> {
    const contrasenaHash = await bcrypt.hash(dto.contrasena, BCRYPT_ROUNDS);

    try {
      const usuario = await this.dataSource.transaction(async (manager) => {
        const negocio = await manager.save(
          manager.create(Negocio, {
            nombre: dto.nombreNegocio,
            tipoNegocio: dto.tipoNegocio,
            correoElectronico: dto.correoNegocio,
            telefono: dto.telefonoNegocio,
            direccion: dto.direccionNegocio,
            planSuscripcion: PlanSuscripcion.GRATIS,
            estado: 'activo',
            fechaRegistro: new Date(),
          }),
        );

        const nuevoUsuario = await manager.save(
          manager.create(Usuario, {
            idNegocio: negocio.idNegocio,
            nombreCompleto: dto.nombreCompletoAdmin,
            correoElectronico: dto.correoAdmin,
            contrasenaHash,
            rol: RolUsuario.ADMIN,
            activo: true,
          }),
        );

        await manager.save(
          manager.create(Suscripcion, {
            idNegocio: negocio.idNegocio,
            plan: PlanSuscripcion.GRATIS,
            fechaInicio: new Date(),
            montoMensual: '0',
            estado: EstadoSuscripcion.ACTIVA,
          }),
        );

        return nuevoUsuario;
      });

      const tokens = await this.emitirTokens(usuario);
      return { usuario: this.aPublico(usuario), tokens };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          errorCode: 'EMAIL_YA_REGISTRADO',
          message: 'El correo del negocio o del administrador ya está en uso',
        });
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<{ usuario: UsuarioPublico; tokens: TokenPair }> {
    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.contrasenaHash')
      .where('usuario.correoElectronico = :correo', { correo: dto.correoElectronico })
      .getOne();

    const credencialesInvalidas = () =>
      new UnauthorizedException({
        errorCode: 'CREDENCIALES_INVALIDAS',
        message: 'Correo o contraseña incorrectos',
      });

    if (!usuario) throw credencialesInvalidas();

    const contrasenaValida = await bcrypt.compare(dto.contrasena, usuario.contrasenaHash);
    if (!contrasenaValida) throw credencialesInvalidas();

    if (!usuario.activo) {
      throw new ForbiddenException({
        errorCode: 'CUENTA_INACTIVA',
        message: 'Esta cuenta está desactivada',
      });
    }

    const tokens = await this.emitirTokens(usuario);
    return { usuario: this.aPublico(usuario), tokens };
  }

  async refrescar(refreshToken: string): Promise<TokenPair> {
    const invalido = () =>
      new UnauthorizedException({
        errorCode: 'REFRESH_TOKEN_INVALIDO',
        message: 'Refresh token inválido o expirado',
      });

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw invalido();
    }

    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.refreshTokenHash')
      .where('usuario.idUsuario = :id', { id: payload.sub })
      .getOne();

    if (!usuario || !usuario.refreshTokenHash) throw invalido();

    const coincide = tokensCoinciden(hashToken(refreshToken), usuario.refreshTokenHash);
    if (!coincide) {
      // Reutilización de un refresh token ya rotado: se revoca la sesión por seguridad.
      await this.usuarioRepo.update(usuario.idUsuario, { refreshTokenHash: null });
      throw invalido();
    }

    return this.emitirTokens(usuario);
  }

  async logout(idUsuario: string): Promise<void> {
    await this.usuarioRepo.update(idUsuario, { refreshTokenHash: null });
  }

  private async emitirTokens(usuario: Usuario): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      idNegocio: usuario.idNegocio,
      rol: usuario.rol,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', {
          infer: true,
        }) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() }, // jti evita colisiones si dos refresh caen en el mismo segundo (iat con resolución de 1s)
        {
          secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', {
            infer: true,
          }) as JwtSignOptions['expiresIn'],
        },
      ),
    ]);

    await this.usuarioRepo.update(usuario.idUsuario, { refreshTokenHash: hashToken(refreshToken) });

    return { accessToken, refreshToken };
  }

  private aPublico(usuario: Usuario): UsuarioPublico {
    return {
      idUsuario: usuario.idUsuario,
      idNegocio: usuario.idNegocio,
      nombreCompleto: usuario.nombreCompleto,
      correoElectronico: usuario.correoElectronico,
      rol: usuario.rol,
    };
  }
}
