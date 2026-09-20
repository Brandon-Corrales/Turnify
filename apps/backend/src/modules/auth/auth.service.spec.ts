import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RolUsuario, TipoNegocio } from '../../database/entities';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * QA (ronda final tras cerrar Backend+Frontend): registrarNegocio/login/
 * refrescar/logout no tenían NINGUNA prueba automatizada — el comentario
 * original de este archivo lo admitía ("se probó manualmente... antes de
 * que existiera Vitest en el repo"). Auth es el módulo más crítico de
 * seguridad de todo el sistema (punto 15 del brief), así que quedarse
 * solo con verificación manual de una sesión ya cerrada no es suficiente
 * cobertura de regresión — estas pruebas cierran ese hueco real.
 */
describe('AuthService.registrarNegocio', () => {
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let usuarioRepo: { update: ReturnType<typeof vi.fn> };
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: AuthService;
  let managerMock: { save: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };

  const dtoValido = {
    nombreNegocio: 'Barbería El Corte',
    tipoNegocio: TipoNegocio.BARBERIA,
    correoNegocio: 'contacto@elcorte.com',
    nombreCompletoAdmin: 'Ana Pérez',
    correoAdmin: 'ana@elcorte.com',
    contrasena: 'Turnify123',
  };

  beforeEach(() => {
    managerMock = {
      create: vi.fn((_entidad, datos) => datos),
      save: vi.fn(async (datos) => ({ idNegocio: 'negocio-1', idUsuario: 'usuario-1', ...datos })),
    };
    dataSource = { transaction: vi.fn((cb) => cb(managerMock)) };
    usuarioRepo = { update: vi.fn().mockResolvedValue(undefined) };
    jwtService = { signAsync: vi.fn().mockResolvedValue('token-fake') };
    configService = { get: vi.fn().mockReturnValue('config-fake') };
    service = new AuthService(
      dataSource as any,
      usuarioRepo as any,
      jwtService as any,
      configService as any,
    );
  });

  it('crea negocio + admin + suscripción gratis dentro de UNA sola transacción', async () => {
    await service.registrarNegocio(dtoValido as any);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const entidadesCreadas = managerMock.create.mock.calls.map((c) => c[1]);
    expect(entidadesCreadas.some((e) => e.nombre === 'Barbería El Corte')).toBe(true);
    expect(entidadesCreadas.some((e) => e.correoElectronico === 'ana@elcorte.com')).toBe(true);
    expect(entidadesCreadas.some((e) => e.plan === 'gratis')).toBe(true);
  });

  it('devuelve el usuario público (sin contrasenaHash) y un par de tokens', async () => {
    const resultado = await service.registrarNegocio(dtoValido as any);

    expect(resultado.usuario).toEqual(
      expect.objectContaining({ idUsuario: 'usuario-1', correoElectronico: 'ana@elcorte.com' }),
    );
    expect(resultado.usuario).not.toHaveProperty('contrasenaHash');
    expect(resultado.tokens).toEqual({ accessToken: 'token-fake', refreshToken: 'token-fake' });
  });

  it('traduce una violación de índice único (correo duplicado) en EMAIL_YA_REGISTRADO', async () => {
    dataSource.transaction.mockRejectedValue({ code: '23505' });

    await expect(service.registrarNegocio(dtoValido as any)).rejects.toMatchObject({
      response: { errorCode: 'EMAIL_YA_REGISTRADO' },
    });
  });

  it('propaga cualquier otro error de la transacción tal cual (no lo enmascara como EMAIL_YA_REGISTRADO)', async () => {
    dataSource.transaction.mockRejectedValue(new Error('boom'));
    await expect(service.registrarNegocio(dtoValido as any)).rejects.toThrow('boom');
  });
});

describe('AuthService.login', () => {
  let usuarioRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let queryBuilder: {
    addSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;
  const contrasenaHashReal = bcrypt.hashSync('Turnify123', 10);

  beforeEach(() => {
    queryBuilder = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    };
    usuarioRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      update: vi.fn().mockResolvedValue(undefined),
    };
    jwtService = { signAsync: vi.fn().mockResolvedValue('token-fake') };
    service = new AuthService(
      undefined as any,
      usuarioRepo as any,
      jwtService as any,
      { get: vi.fn().mockReturnValue('config-fake') } as any,
    );
  });

  const dtoValido = { correoElectronico: 'ana@elcorte.com', contrasena: 'Turnify123' };

  it('rechaza con CREDENCIALES_INVALIDAS si el correo no existe (sin revelar cuál de los dos falló)', async () => {
    queryBuilder.getOne.mockResolvedValue(null);
    await expect(service.login(dtoValido)).rejects.toMatchObject({
      response: { errorCode: 'CREDENCIALES_INVALIDAS' },
    });
  });

  it('rechaza con CREDENCIALES_INVALIDAS si la contraseña no coincide (mismo errorCode que correo inexistente)', async () => {
    queryBuilder.getOne.mockResolvedValue({
      idUsuario: 'u1',
      contrasenaHash: contrasenaHashReal,
      activo: true,
    });
    await expect(
      service.login({ ...dtoValido, contrasena: 'otra-contrasena' }),
    ).rejects.toMatchObject({ response: { errorCode: 'CREDENCIALES_INVALIDAS' } });
  });

  it('rechaza con CUENTA_INACTIVA si el usuario existe y la contraseña es correcta pero está desactivado', async () => {
    queryBuilder.getOne.mockResolvedValue({
      idUsuario: 'u1',
      contrasenaHash: contrasenaHashReal,
      activo: false,
    });
    await expect(service.login(dtoValido)).rejects.toThrow(ForbiddenException);
  });

  it('inicia sesión y emite tokens si la contraseña es correcta y la cuenta está activa', async () => {
    queryBuilder.getOne.mockResolvedValue({
      idUsuario: 'u1',
      idNegocio: 'n1',
      nombreCompleto: 'Ana Pérez',
      correoElectronico: 'ana@elcorte.com',
      rol: RolUsuario.ADMIN,
      contrasenaHash: contrasenaHashReal,
      activo: true,
    });

    const resultado = await service.login(dtoValido);

    expect(resultado.usuario.idUsuario).toBe('u1');
    expect(resultado.tokens).toEqual({ accessToken: 'token-fake', refreshToken: 'token-fake' });
    // emitirTokens() guarda el hash del refresh token nuevo — nunca en claro.
    expect(usuarioRepo.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
    );
    expect(usuarioRepo.update.mock.calls[0][1].refreshTokenHash).not.toBe('token-fake');
  });
});

describe('AuthService.refrescar', () => {
  let usuarioRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let queryBuilder: {
    addSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn>; signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;

  const REFRESH_TOKEN_VIGENTE = 'refresh-token-vigente';
  const REFRESH_TOKEN_YA_ROTADO = 'refresh-token-viejo-ya-usado';
  const payload = { sub: 'u1', idNegocio: 'n1', rol: RolUsuario.ADMIN };

  beforeEach(() => {
    queryBuilder = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({
        idUsuario: 'u1',
        refreshTokenHash: hashToken(REFRESH_TOKEN_VIGENTE),
      }),
    };
    usuarioRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      update: vi.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      verifyAsync: vi.fn().mockResolvedValue(payload),
      signAsync: vi.fn().mockResolvedValue('token-nuevo'),
    };
    service = new AuthService(
      undefined as any,
      usuarioRepo as any,
      jwtService as any,
      { get: vi.fn().mockReturnValue('config-fake') } as any,
    );
  });

  it('rechaza con REFRESH_TOKEN_INVALIDO si el JWT no verifica (firma inválida o expirado)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(service.refrescar('token-cualquiera')).rejects.toMatchObject({
      response: { errorCode: 'REFRESH_TOKEN_INVALIDO' },
    });
  });

  it('rechaza si el usuario no tiene ningún refreshTokenHash guardado (ya cerró sesión antes)', async () => {
    queryBuilder.getOne.mockResolvedValue({ idUsuario: 'u1', refreshTokenHash: null });
    await expect(service.refrescar(REFRESH_TOKEN_VIGENTE)).rejects.toThrow(UnauthorizedException);
  });

  it('emite un par de tokens nuevo si el refresh token coincide con el hash guardado', async () => {
    const resultado = await service.refrescar(REFRESH_TOKEN_VIGENTE);
    expect(resultado).toEqual({ accessToken: 'token-nuevo', refreshToken: 'token-nuevo' });
  });

  it('SEGURIDAD — detección de reuso: un refresh token válido pero YA ROTADO (no coincide con el hash guardado) revoca la sesión entera', async () => {
    // El usuario tiene guardado el hash del token vigente (ya rotado desde
    // REFRESH_TOKEN_YA_ROTADO), pero alguien reenvía el token viejo — un
    // atacante que robó un refresh token de una respuesta anterior, o un
    // reintento de red duplicado. Debe rechazarse Y revocar la sesión.
    await expect(service.refrescar(REFRESH_TOKEN_YA_ROTADO)).rejects.toMatchObject({
      response: { errorCode: 'REFRESH_TOKEN_INVALIDO' },
    });
    expect(usuarioRepo.update).toHaveBeenCalledWith('u1', { refreshTokenHash: null });
  });

  it('rechaza si el usuario del payload ya no existe', async () => {
    queryBuilder.getOne.mockResolvedValue(null);
    await expect(service.refrescar(REFRESH_TOKEN_VIGENTE)).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService.logout', () => {
  it('limpia el refreshTokenHash del usuario (invalida cualquier refresh futuro)', async () => {
    const usuarioRepo = { update: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      undefined as any,
      usuarioRepo as any,
      undefined as any,
      undefined as any,
    );

    await service.logout('u1');

    expect(usuarioRepo.update).toHaveBeenCalledWith('u1', { refreshTokenHash: null });
  });
});

describe('AuthService.obtenerPerfil', () => {
  let usuarioRepo: { findOne: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    usuarioRepo = { findOne: vi.fn() };
    service = new AuthService(
      undefined as any,
      usuarioRepo as any,
      undefined as any,
      undefined as any,
    );
  });

  it('devuelve el perfil público del usuario (sin contrasenaHash ni refreshTokenHash)', async () => {
    usuarioRepo.findOne.mockResolvedValue({
      idUsuario: 'u1',
      idNegocio: 'n1',
      nombreCompleto: 'Ana Pérez',
      correoElectronico: 'ana@turnify.app',
      rol: RolUsuario.ADMIN,
      contrasenaHash: 'no-debe-salir',
    });

    const perfil = await service.obtenerPerfil('u1');
    expect(perfil).toEqual({
      idUsuario: 'u1',
      idNegocio: 'n1',
      nombreCompleto: 'Ana Pérez',
      correoElectronico: 'ana@turnify.app',
      rol: RolUsuario.ADMIN,
    });
    expect(perfil).not.toHaveProperty('contrasenaHash');
  });

  it('lanza USUARIO_NO_ENCONTRADO si el usuario ya no existe', async () => {
    usuarioRepo.findOne.mockResolvedValue(null);
    await expect(service.obtenerPerfil('inexistente')).rejects.toThrow(NotFoundException);
  });
});
