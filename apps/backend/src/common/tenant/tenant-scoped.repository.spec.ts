import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from 'typeorm';
import { TenantContextService } from './tenant-context.service';
import { TenantScopedRepository } from './tenant-scoped.repository';
import { RolUsuario } from '../../database/entities';

interface Fake {
  idFake: string;
  idNegocio: string;
  nombre: string;
}

function crearRepoMock() {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn((data) => data),
    save: vi.fn((entity) => Promise.resolve(entity)),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as Repository<Fake>;
}

const NEGOCIO_A = 'negocio-a';
const NEGOCIO_B = 'negocio-b';

function runComoNegocio<T>(tenantContext: TenantContextService, idNegocio: string, fn: () => T): T {
  return tenantContext.run({ idNegocio, idUsuario: 'usuario-1', rol: RolUsuario.ADMIN }, fn);
}

describe('TenantScopedRepository', () => {
  let repoMock: ReturnType<typeof crearRepoMock>;
  let tenantContext: TenantContextService;
  let tenantRepo: TenantScopedRepository<Fake>;

  beforeEach(() => {
    repoMock = crearRepoMock();
    tenantContext = new TenantContextService();
    tenantRepo = new TenantScopedRepository(repoMock, tenantContext);
  });

  it('inyecta idNegocio en find() aunque el caller no lo pida', async () => {
    await runComoNegocio(tenantContext, NEGOCIO_A, () => tenantRepo.find({ where: { nombre: 'x' } as any } as any));
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombre: 'x', idNegocio: NEGOCIO_A } }),
    );
  });

  it('inyecta idNegocio en find() incluso sin where alguno', async () => {
    await runComoNegocio(tenantContext, NEGOCIO_A, () => tenantRepo.find());
    expect(repoMock.find).toHaveBeenCalledWith(expect.objectContaining({ where: { idNegocio: NEGOCIO_A } }));
  });

  it('ignora un idNegocio distinto que el caller intente colar en el where (el del contexto siempre gana)', async () => {
    await runComoNegocio(tenantContext, NEGOCIO_A, () =>
      tenantRepo.findOne({ where: { idNegocio: NEGOCIO_B } as any }),
    );
    expect(repoMock.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { idNegocio: NEGOCIO_A } }));
  });

  it('create() fija idNegocio del tenant actual', () => {
    runComoNegocio(tenantContext, NEGOCIO_A, () => tenantRepo.create({ nombre: 'x' } as any));
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ idNegocio: NEGOCIO_A }));
  });

  it('save() sobreescribe cualquier idNegocio ajeno con el del tenant actual', async () => {
    await runComoNegocio(tenantContext, NEGOCIO_A, () =>
      tenantRepo.save({ idFake: '1', idNegocio: NEGOCIO_B, nombre: 'x' } as any),
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ idNegocio: NEGOCIO_A }));
  });

  it('update() y softDelete() agregan idNegocio al criterio', async () => {
    await runComoNegocio(tenantContext, NEGOCIO_A, () =>
      tenantRepo.update({ idFake: '1' } as any, { nombre: 'y' } as any),
    );
    expect(repoMock.update).toHaveBeenCalledWith(expect.objectContaining({ idFake: '1', idNegocio: NEGOCIO_A }), {
      nombre: 'y',
    });

    await runComoNegocio(tenantContext, NEGOCIO_A, () => tenantRepo.softDelete({ idFake: '1' } as any));
    expect(repoMock.softDelete).toHaveBeenCalledWith(expect.objectContaining({ idFake: '1', idNegocio: NEGOCIO_A }));
  });

  it('nunca deja ver datos de otro negocio: dos contextos concurrentes no se mezclan', async () => {
    await Promise.all([
      runComoNegocio(tenantContext, NEGOCIO_A, () => tenantRepo.find()),
      runComoNegocio(tenantContext, NEGOCIO_B, () => tenantRepo.find()),
    ]);
    const wheresUsados = (repoMock.find as any).mock.calls.map((call: any) => call[0].where.idNegocio);
    expect(wheresUsados.sort()).toEqual([NEGOCIO_A, NEGOCIO_B]);
  });

  it('falla cerrado: usar el repositorio fuera de un contexto de tenant lanza en vez de consultar sin filtrar', async () => {
    await expect(tenantRepo.find()).rejects.toThrow(/no hay contexto de negocio activo/i);
    expect(repoMock.find).not.toHaveBeenCalled();
  });
});
