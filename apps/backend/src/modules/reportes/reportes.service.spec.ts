import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EXPRESION_DIA_LOCAL, ReportesService } from './reportes.service';
import { TenantContextService } from '../../common/tenant';
import { RolUsuario } from '../../database/entities';
import { EstadoReserva } from '../../database/entities';

function crearQueryBuilderMock(resultado: { rawMany?: unknown[]; rawOne?: unknown }) {
  const qb: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(resultado.rawMany ?? []),
    getRawOne: vi.fn().mockResolvedValue(resultado.rawOne),
  };
  return qb;
}

describe('ReportesService', () => {
  let reservaRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let negocioRepo: { findOne: ReturnType<typeof vi.fn> };
  let tenantContext: TenantContextService;
  let service: ReportesService;

  beforeEach(() => {
    reservaRepo = { createQueryBuilder: vi.fn() };
    negocioRepo = { findOne: vi.fn().mockResolvedValue({ zonaHoraria: 'America/Costa_Rica' }) };
    tenantContext = new TenantContextService();
    const real = new ReportesService(reservaRepo as any, negocioRepo as any, tenantContext);
    // Mismo servicio, ejecutado dentro del contexto de un negocio.
    service = {
      resumen: (desde: string, hasta: string) =>
        tenantContext.run(
          { idNegocio: 'negocio-1', idUsuario: 'admin-1', rol: RolUsuario.ADMIN },
          () => real.resumen(desde, hasta),
        ),
    } as ReportesService;
  });

  it('resumen() rechaza si "desde" es posterior a "hasta"', async () => {
    await expect(
      service.resumen('2026-09-30T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
    ).rejects.toThrow(BadRequestException);
  });

  it('resumen() combina reservasPorEstado, reservasPorDia e ingresosEstimados', async () => {
    reservaRepo.createQueryBuilder
      .mockReturnValueOnce(
        crearQueryBuilderMock({
          rawMany: [
            { estado: EstadoReserva.CONFIRMADA, cantidad: '5' },
            { estado: EstadoReserva.CANCELADA, cantidad: '2' },
          ],
        }),
      )
      .mockReturnValueOnce(
        crearQueryBuilderMock({
          rawMany: [
            { fecha: '2026-09-01', cantidad: '3' },
            { fecha: '2026-09-02', cantidad: '4' },
          ],
        }),
      )
      .mockReturnValueOnce(crearQueryBuilderMock({ rawOne: { total: '35000.00' } }));

    const resultado = await service.resumen('2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.000Z');

    expect(resultado.reservasPorEstado[EstadoReserva.CONFIRMADA]).toBe(5);
    expect(resultado.reservasPorEstado[EstadoReserva.CANCELADA]).toBe(2);
    expect(resultado.reservasPorEstado[EstadoReserva.PENDIENTE]).toBe(0); // no aparece en las filas, pero queda en 0, no undefined
    expect(resultado.reservasPorDia).toEqual([
      { fecha: '2026-09-01', cantidad: 3 },
      { fecha: '2026-09-02', cantidad: 4 },
    ]);
    expect(resultado.ingresosEstimados).toBe(35000);
    expect(resultado.rangoFechas).toEqual({
      desde: '2026-09-01T00:00:00.000Z',
      hasta: '2026-09-30T23:59:59.000Z',
    });
  });

  it('ingresosEstimados excluye reservas canceladas del cálculo (filtro aplicado en la query)', async () => {
    reservaRepo.createQueryBuilder
      .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
      .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
      .mockReturnValueOnce(crearQueryBuilderMock({ rawOne: { total: '0' } }));

    await service.resumen('2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.000Z');

    const qbIngresos = reservaRepo.createQueryBuilder.mock.results[2].value;
    expect(qbIngresos.andWhere).toHaveBeenCalledWith('reserva.estado != :cancelada', {
      cancelada: EstadoReserva.CANCELADA,
    });
  });

  it('ingresosEstimados devuelve 0 (no undefined/NaN) cuando no hay filas', async () => {
    reservaRepo.createQueryBuilder
      .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
      .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
      .mockReturnValueOnce(crearQueryBuilderMock({ rawOne: undefined }));

    const resultado = await service.resumen('2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.000Z');
    expect(resultado.ingresosEstimados).toBe(0);
  });

  describe('reservas por día en la zona del negocio (Bloque 5, punto 5.1)', () => {
    async function correrCon(zonaHoraria: string) {
      negocioRepo.findOne.mockResolvedValue({ zonaHoraria });
      reservaRepo.createQueryBuilder
        .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
        .mockReturnValueOnce(crearQueryBuilderMock({ rawMany: [] }))
        .mockReturnValueOnce(crearQueryBuilderMock({ rawOne: { total: '0' } }));
      await service.resumen('2027-03-01T06:00:00.000Z', '2027-04-01T05:59:59.999Z');
      return reservaRepo.createQueryBuilder.mock.results[1].value;
    }

    it('agrupa con AT TIME ZONE (no en UTC) y la zona del negocio: Costa Rica', async () => {
      const qb = await correrCon('America/Costa_Rica');
      expect(EXPRESION_DIA_LOCAL).toContain('AT TIME ZONE :zona');
      expect(qb.select).toHaveBeenCalledWith(
        expect.stringContaining('AT TIME ZONE :zona'),
        'fecha',
      );
      expect(qb.groupBy).toHaveBeenCalledWith(EXPRESION_DIA_LOCAL);
      expect(qb.setParameter).toHaveBeenCalledWith('zona', 'America/Costa_Rica');
    });

    it('usa la zona con horario de verano tal cual: Nueva York', async () => {
      const qb = await correrCon('America/New_York');
      expect(qb.setParameter).toHaveBeenCalledWith('zona', 'America/New_York');
    });

    it('una zona inválida en la base cae en Costa Rica, nunca en UTC', async () => {
      const qb = await correrCon('No/Existe');
      expect(qb.setParameter).toHaveBeenCalledWith('zona', 'America/Costa_Rica');
    });
  });
});
