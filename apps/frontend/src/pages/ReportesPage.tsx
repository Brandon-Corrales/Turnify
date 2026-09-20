import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, CalendarX2, Coins, Download, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton } from '@/components/ui';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { negociosApi } from '@/lib/negocios-api';
import { reportesApi, type ResumenReportes } from '@/lib/reportes-api';
import type { EstadoReserva } from '@/lib/reservas-api';

type Periodo = 'esteMes' | 'mesPasado' | 'ultimos3Meses';

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  esteMes: 'Este mes',
  mesPasado: 'Mes pasado',
  ultimos3Meses: 'Últimos 3 meses',
};

const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  ausente: 'Ausente',
};

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  pendiente: '#d97706',
  confirmada: '#059669',
  cancelada: '#dc2626',
  ausente: '#64748b',
};

function rangoDe(periodo: Periodo): { desde: string; hasta: string } {
  const ahora = new Date();
  let inicioMes = ahora.getUTCMonth();
  let anio = ahora.getUTCFullYear();
  let meses = 1;

  if (periodo === 'mesPasado') {
    inicioMes -= 1;
  } else if (periodo === 'ultimos3Meses') {
    inicioMes -= 2;
    meses = 3;
  }
  if (inicioMes < 0) {
    inicioMes += 12;
    anio -= 1;
  }

  const desde = new Date(Date.UTC(anio, inicioMes, 1));
  const hasta = new Date(Date.UTC(anio, inicioMes + meses, 0, 23, 59, 59, 999));
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

function formatearColones(monto: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(monto);
}

function formatearDiaCorto(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

function descargarCsv(resumen: ResumenReportes): void {
  const filas = [
    ['Fecha', 'Reservas'],
    ...resumen.reservasPorDia.map((d) => [d.fecha, String(d.cantidad)]),
  ];
  const csv = filas.map((fila) => fila.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `reservas-${resumen.rangoFechas.desde.slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('esteMes');
  const { desde, hasta } = rangoDe(periodo);

  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });
  const exportacionHabilitada = negocioQuery.data?.planSuscripcion !== 'gratis';

  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen', desde, hasta],
    queryFn: () => reportesApi.obtenerResumen({ desde, hasta }),
  });

  const datosBarras = useMemo(
    () =>
      resumenQuery.data?.reservasPorDia.map((d) => ({
        fecha: formatearDiaCorto(d.fecha),
        reservas: d.cantidad,
      })) ?? [],
    [resumenQuery.data],
  );

  const datosPastel = useMemo(() => {
    if (!resumenQuery.data) return [];
    return (Object.entries(resumenQuery.data.reservasPorEstado) as [EstadoReserva, number][])
      .filter(([, cantidad]) => cantidad > 0)
      .map(([estado, cantidad]) => ({
        estado: ETIQUETA_ESTADO[estado],
        cantidad,
        color: COLOR_ESTADO[estado],
      }));
  }, [resumenQuery.data]);

  const total = resumenQuery.data
    ? Object.values(resumenQuery.data.reservasPorEstado).reduce((a, b) => a + b, 0)
    : 0;
  const canceladas = resumenQuery.data?.reservasPorEstado.cancelada ?? 0;
  const tasaCancelacion = total > 0 ? Math.round((canceladas / total) * 100) : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Reportes</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Reservas e ingresos estimados, calculados desde tus datos reales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              {(Object.keys(ETIQUETA_PERIODO) as Periodo[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    periodo === p
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {ETIQUETA_PERIODO[p]}
                </button>
              ))}
            </div>
            <Boton
              variante="secundario"
              tamano="sm"
              disabled={!exportacionHabilitada || !resumenQuery.data}
              title={
                exportacionHabilitada
                  ? 'Exportar reservas por día a CSV'
                  : 'Exportar datos está disponible en el Plan de Pago'
              }
              onClick={() => resumenQuery.data && descargarCsv(resumenQuery.data)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar
            </Boton>
          </div>
        </div>

        {!exportacionHabilitada && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            La exportación de datos está disponible en el Plan de Pago — tu negocio está en el Plan
            Gratis.
          </p>
        )}

        {resumenQuery.isPending && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {resumenQuery.isError && (
          <p className="mt-6 text-sm text-danger">No se pudo cargar el reporte de este período.</p>
        )}

        {resumenQuery.data && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  {total}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Reservas totales</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-warning dark:bg-amber-900/30">
                  <Coins className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatearColones(resumenQuery.data.ingresosEstimados)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ingresos estimados</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-danger dark:bg-red-900/30">
                  <CalendarX2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  {tasaCancelacion}%
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tasa de cancelación</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <TrendingUp
                    className="h-4 w-4 text-primary-600 dark:text-primary-400"
                    aria-hidden="true"
                  />
                  Reservas por día
                </div>
                {total === 0 ? (
                  <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No hay reservas en este período.
                  </p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosBarras}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-slate-200 dark:stroke-slate-700"
                        />
                        <XAxis
                          dataKey="fecha"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="reservas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Reservas por estado
                </p>
                {datosPastel.length === 0 ? (
                  <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Sin datos todavía.
                  </p>
                ) : (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={datosPastel}
                          dataKey="cantidad"
                          nameKey="estado"
                          innerRadius={45}
                          outerRadius={75}
                        >
                          {datosPastel.map((d) => (
                            <Cell key={d.estado} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
