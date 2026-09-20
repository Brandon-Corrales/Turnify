import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { EstadoReserva } from '../../database/entities';

function crearQueryBuilderMock(resultado: { rawMany?: unknown[]; rawOne?: unknown }) {
  const qb: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(resultado.rawMany ?? []),
    getRawOne: vi.fn().mockResolvedValue(resultado.rawOne),
  };
  return qb;
}

describe('ReportesService', () => {
  let reservaRepo: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let service: ReportesService;

  beforeEach(() => {
    reservaRepo = { createQueryBuilder: vi.fn() };
    service = new ReportesService(reservaRepo as any);
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
});
