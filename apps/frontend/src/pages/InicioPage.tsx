import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, CalendarX2, CheckCircle2, Coins, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { negociosApi } from '@/lib/negocios-api';
import { reportesApi, type ResumenReportes } from '@/lib/reportes-api';

function rangoMesActual(): { desde: string; hasta: string } {
  const ahora = new Date();
  const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const hasta = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

function formatearColones(monto: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(monto);
}

function totalReservas(porEstado: ResumenReportes['reservasPorEstado']): number {
  return Object.values(porEstado).reduce((suma, cantidad) => suma + cantidad, 0);
}

interface TarjetaKpiProps {
  icono: typeof Calendar;
  etiqueta: string;
  valor: string;
  claseIcono: string;
}

function TarjetaKpi({ icono: Icono, etiqueta, valor, claseIcono }: TarjetaKpiProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${claseIcono}`}>
        <Icono className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{valor}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{etiqueta}</p>
    </div>
  );
}

/** Barras simples (sin librería de gráficos, reservada para la pantalla de Reportes) escaladas por el día con más reservas del mes. */
function GraficoReservasPorDia({ datos }: { datos: ResumenReportes['reservasPorDia'] }) {
  const maximo = Math.max(1, ...datos.map((d) => d.cantidad));

  return (
    <div
      className="flex h-32 items-end justify-start gap-1"
      role="img"
      aria-label="Reservas por día del mes"
    >
      {datos.map((dia, i) => (
        <motion.div
          key={dia.fecha}
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(4, (dia.cantidad / maximo) * 100)}%` }}
          transition={{ duration: 0.4, delay: i * 0.01 }}
          className="w-3 max-w-6 min-w-[3px] shrink-0 rounded-t bg-primary-500 dark:bg-primary-400"
          title={`${new Date(dia.fecha).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}: ${dia.cantidad} reserva(s)`}
        />
      ))}
    </div>
  );
}

export default function InicioPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { desde, hasta } = rangoMesActual();

  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });

  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen', desde, hasta],
    queryFn: () => reportesApi.obtenerResumen({ desde, hasta }),
  });

  const esPlanGratis = negocioQuery.data?.planSuscripcion === 'gratis';
  const resumen = resumenQuery.data;
  const total = resumen ? totalReservas(resumen.reservasPorEstado) : 0;
  const nombreMes = new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Hola, {usuario?.nombreCompleto?.split(' ')[0]}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 capitalize">
              Resumen de {nombreMes}
            </p>
          </div>
          {negocioQuery.isPending ? (
            <Skeleton className="h-7 w-24 rounded-full" />
          ) : (
            <span
              className={
                esPlanGratis
                  ? 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  : 'rounded-full bg-secondary-100 px-3 py-1 text-xs font-medium text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-300'
              }
            >
              {esPlanGratis ? 'Plan Gratis' : 'Plan de Pago'}
            </span>
          )}
        </div>

        {resumenQuery.isPending && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {resumenQuery.isError && (
          <p className="mt-6 text-sm text-danger">
            No se pudo cargar el resumen del mes. Intenta de nuevo más tarde.
          </p>
        )}

        {resumen && (
          <>
            <motion.div
              initial="oculto"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                {
                  icono: Calendar,
                  etiqueta: 'Reservas este mes',
                  valor: String(total),
                  claseIcono:
                    'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400',
                },
                {
                  icono: CheckCircle2,
                  etiqueta: 'Confirmadas',
                  valor: String(resumen.reservasPorEstado.confirmada),
                  claseIcono:
                    'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/40 dark:text-secondary-400',
                },
                {
                  icono: CalendarX2,
                  etiqueta: 'Canceladas',
                  valor: String(resumen.reservasPorEstado.cancelada),
                  claseIcono: 'bg-red-50 text-danger dark:bg-red-900/30',
                },
                {
                  icono: Coins,
                  etiqueta: 'Ingresos estimados',
                  valor: formatearColones(resumen.ingresosEstimados),
                  claseIcono: 'bg-amber-50 text-warning dark:bg-amber-900/30',
                },
              ].map((tarjeta) => (
                <motion.div
                  key={tarjeta.etiqueta}
                  variants={{ oculto: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                >
                  <TarjetaKpi {...tarjeta} />
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <TrendingUp
                  className="h-4 w-4 text-primary-600 dark:text-primary-400"
                  aria-hidden="true"
                />
                Reservas por día
              </div>
              {total === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
                  <Calendar
                    className="h-8 w-8 text-slate-300 dark:text-slate-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Todavía no tienes reservas este mes.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/calendario')}
                    className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    Ver calendario
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <GraficoReservasPorDia datos={resumen.reservasPorDia} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
