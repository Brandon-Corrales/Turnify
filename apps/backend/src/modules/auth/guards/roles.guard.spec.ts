import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { RolUsuario } from '../../../database/entities';

/** QA (ronda final): guard de autorización por rol, sin ninguna prueba dedicada hasta ahora. */
function crearContexto(rolesRequeridos: RolUsuario[] | undefined, usuario?: { rol: RolUsuario }) {
  const request = { user: usuario };
  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { contexto, rolesRequeridos };
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    guard = new RolesGuard(reflector as any);
  });

  it('deja pasar si el handler no tiene @Roles(...) (sin restricción de rol)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { contexto } = crearContexto(undefined, { rol: RolUsuario.EMPLEADO });
    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('deja pasar si el rol del usuario está en la lista de roles permitidos', () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    const { contexto } = crearContexto([RolUsuario.ADMIN], { rol: RolUsuario.ADMIN });
    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('rechaza con ROL_NO_AUTORIZADO si el rol del usuario no está permitido', () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    const { contexto } = crearContexto([RolUsuario.ADMIN], { rol: RolUsuario.EMPLEADO });
    expect(() => guard.canActivate(contexto)).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({ errorCode: 'ROL_NO_AUTORIZADO' }),
      }),
    );
  });

  it('rechaza si hay roles requeridos pero la request no trae usuario (JwtAuthGuard no corrió antes)', () => {
    reflector.getAllAndOverride.mockReturnValue([RolUsuario.ADMIN]);
    const { contexto } = crearContexto([RolUsuario.ADMIN], undefined);
    expect(() => guard.canActivate(contexto)).toThrow();
  });
});
