import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from './ws-jwt.guard';

function crearContexto(clientData: {
  auth?: Record<string, unknown>;
  data?: Record<string, unknown>;
}) {
  const client = { handshake: { auth: clientData.auth ?? {} }, data: clientData.data ?? {} };
  const contexto = {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ExecutionContext;
  return { contexto, client };
}

describe('WsJwtGuard', () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let guard: WsJwtGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    configService = { get: vi.fn().mockReturnValue('secreto-fake') };
    guard = new WsJwtGuard(jwtService as any, configService as any);
  });

  it('rechaza la conexión si no viene token en handshake.auth', async () => {
    const { contexto } = crearContexto({});
    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(WsException);
  });

  it('rechaza si el token es inválido o expiró', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('expirado'));
    const { contexto } = crearContexto({ auth: { token: 'token-malo' } });
    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(WsException);
  });

  it('permite el paso y guarda el payload en client.data.user si el token es válido', async () => {
    const payload = { sub: 'usuario-1', idNegocio: 'negocio-1', rol: 'admin' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const { contexto, client } = crearContexto({ auth: { token: 'token-bueno' } });

    await expect(guard.canActivate(contexto)).resolves.toBe(true);

    expect(client.data.user).toEqual(payload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-bueno', { secret: 'secreto-fake' });
  });

  it('no vuelve a verificar el token si client.data.user ya está seteado (reconexión)', async () => {
    const { contexto } = crearContexto({ data: { user: { sub: 'usuario-1' } } });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
