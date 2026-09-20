import { apiFetch } from './api';
import type { EstadoReserva } from './reservas-api';

export interface ResumenReportes {
  rangoFechas: { desde: string; hasta: string };
  reservasPorEstado: Record<EstadoReserva, number>;
  reservasPorDia: Array<{ fecha: string; cantidad: number }>;
  ingresosEstimados: number;
}

export interface ResumenReportesParams {
  desde: string;
  hasta: string;
}

export const reportesApi = {
  obtenerResumen: ({ desde, hasta }: ResumenReportesParams) =>
    apiFetch<ResumenReportes>(
      `/reportes/resumen?${new URLSearchParams({ desde, hasta }).toString()}`,
    ),
};
