import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectTenantRepository, TenantScopedRepository } from '../../common/tenant';
import { EstadoReserva, Reserva } from '../../database/entities';

export interface ResumenReportes {
  rangoFechas: { desde: string; hasta: string };
  reservasPorEstado: Record<EstadoReserva, number>;
  reservasPorDia: Array<{ fecha: string; cantidad: number }>;
  ingresosEstimados: number;
}

/**
 * "Ingresos estimados" (no "ingresos reales"): se calcula sumando el
 * precio del SERVICIO de cada reserva no cancelada en el rango — Turnify
 * no procesa cobros por reserva individual (el único cobro real es la
 * SUSCRIPCION del negocio a la plataforma, vía Stripe), así que esto es
 * una proyección basada en el catálogo de precios, no dinero
 * efectivamente cobrado. El nombre del campo lo deja explícito para no
 * confundir al admin.
 */
@Injectable()
export class ReportesService {
  constructor(
    @InjectTenantRepository(Reserva) private readonly reservaRepo: TenantScopedRepository<Reserva>,
  ) {}

  async resumen(desdeIso: string, hastaIso: string): Promise<ResumenReportes> {
    const desde = new Date(desdeIso);
    const hasta = new Date(hastaIso);
    if (desde > hasta) {
      throw new BadRequestException({
        errorCode: 'RANGO_DE_FECHAS_INVALIDO',
        message: '"desde" no puede ser posterior a "hasta"',
      });
    }

    const [reservasPorEstado, reservasPorDia, ingresosEstimados] = await Promise.all([
      this.contarPorEstado(desde, hasta),
      this.contarPorDia(desde, hasta),
      this.sumarIngresosEstimados(desde, hasta),
    ]);

    return {
      rangoFechas: { desde: desdeIso, hasta: hastaIso },
      reservasPorEstado,
      reservasPorDia,
      ingresosEstimados,
    };
  }

  private async contarPorEstado(desde: Date, hasta: Date): Promise<Record<EstadoReserva, number>> {
    const filas = await this.reservaRepo
      .createQueryBuilder('reserva')
      .select('reserva.estado', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .andWhere('reserva.fechaHoraInicio BETWEEN :desde AND :hasta', { desde, hasta })
      .groupBy('reserva.estado')
      .getRawMany<{ estado: EstadoReserva; cantidad: string }>();

    const base = Object.fromEntries(
      Object.values(EstadoReserva).map((estado) => [estado, 0]),
    ) as Record<EstadoReserva, number>;
    for (const fila of filas) base[fila.estado] = Number(fila.cantidad);
    return base;
  }

  private async contarPorDia(
    desde: Date,
    hasta: Date,
  ): Promise<Array<{ fecha: string; cantidad: number }>> {
    const filas = await this.reservaRepo
      .createQueryBuilder('reserva')
      .select("TO_CHAR(DATE_TRUNC('day', reserva.fechaHoraInicio), 'YYYY-MM-DD')", 'fecha')
      .addSelect('COUNT(*)', 'cantidad')
      .andWhere('reserva.fechaHoraInicio BETWEEN :desde AND :hasta', { desde, hasta })
      .groupBy("DATE_TRUNC('day', reserva.fechaHoraInicio)")
      .orderBy("DATE_TRUNC('day', reserva.fechaHoraInicio)", 'ASC')
      .getRawMany<{ fecha: string; cantidad: string }>();

    return filas.map((fila) => ({ fecha: fila.fecha, cantidad: Number(fila.cantidad) }));
  }

  private async sumarIngresosEstimados(desde: Date, hasta: Date): Promise<number> {
    const fila = await this.reservaRepo
      .createQueryBuilder('reserva')
      .innerJoin('reserva.servicio', 'servicio')
      .select('COALESCE(SUM(servicio.precio), 0)', 'total')
      .andWhere('reserva.fechaHoraInicio BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('reserva.estado != :cancelada', { cancelada: EstadoReserva.CANCELADA })
      .getRawOne<{ total: string }>();
    return Number(fila?.total ?? 0);
  }
}
