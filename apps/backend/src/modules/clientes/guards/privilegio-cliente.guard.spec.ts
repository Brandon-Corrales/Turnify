import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { PrivilegioClienteGuard } from './privilegio-cliente.guard';
import { CanalPreferido, NivelCliente } from '../../../database/entities';

const NEGOCIO_ID = 'negocio-1';

function crearContextoMock(body: Record<string, unknown>, params: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body, params, user: { idNegocio: NEGOCIO_ID } }),
    }),
  } as unknown as ExecutionContext;
}

describe('PrivilegioClienteGuard', () => {
  it('permite el paso sin consultar nada si canalPreferido no es whatsapp', async () => {
    const privilegios = { verificarCanalWhatsapp: vi.fn() };
    const guard = new PrivilegioClienteGuard(privilegios as any);

    const resultado = await guard.canActivate(
      crearContextoMock({ canalPreferido: CanalPreferido.EMAIL }),
    );

    expect(resultado).toBe(true);
    expect(privilegios.verificarCanalWhatsapp).not.toHaveBeenCalled();
  });

  it('delega en PrivilegiosClienteService con idNegocio, :id de la ruta y nivelCliente del body', async () => {
    const privilegios = { verificarCanalWhatsapp: vi.fn().mockResolvedValue(undefined) };
    const guard = new PrivilegioClienteGuard(privilegios as any);

    const resultado = await guard.canActivate(
      crearContextoMock(
        { canalPreferido: CanalPreferido.WHATSAPP, nivelCliente: NivelCliente.PREMIUM },
        { id: 'cliente-1' },
      ),
    );

    expect(resultado).toBe(true);
    expect(privilegios.verificarCanalWhatsapp).toHaveBeenCalledWith(
      NEGOCIO_ID,
      'cliente-1',
      NivelCliente.PREMIUM,
    );
  });

  it('propaga el rechazo de PrivilegiosClienteService (ej. ForbiddenException)', async () => {
    const privilegios = {
      verificarCanalWhatsapp: vi.fn().mockRejectedValue(new Error('rechazado')),
    };
    const guard = new PrivilegioClienteGuard(privilegios as any);

    await expect(
      guard.canActivate(crearContextoMock({ canalPreferido: CanalPreferido.WHATSAPP })),
    ).rejects.toThrow('rechazado');
  });
});
