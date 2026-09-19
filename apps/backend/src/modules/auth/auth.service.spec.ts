import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolUsuario } from '../../database/entities';

/**
 * Solo cubre obtenerPerfil() (agregado en la tarjeta de Login/Registro del
 * frontend, para restaurar la sesión tras un refresh de página) — el resto
 * de AuthService se probó manualmente contra la app real cuando se
 * construyó (antes de que existiera Vitest en el repo), ver PROGRESS.md.
 */
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
