import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarX2, Ban, User } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Select, ToggleVista, useToast } from '@/components/ui';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useVistaPreferida } from '@/lib/vista-preferida';
import { ApiError } from '@/lib/api';
import {
  crearEtiquetaEstadoReserva,
  reservasApi,
  type EstadoReserva,
  type Reserva,
} from '@/lib/reservas-api';

const LIMITE = 12;

const ESTILO_ESTADO: Record<EstadoReserva, string> = {
  pendiente: 'bg-amber-50 text-warning dark:bg-amber-900/30 dark:text-amber-400',
  confirmada: 'bg-secondary-50 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
  cancelada: 'bg-red-50 text-danger dark:bg-red-900/30 dark:text-red-400',
  ausente: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function formatearFechaHora(iso: string, idioma: string): string {
  return new Date(iso).toLocaleString(idioma.startsWith('en') ? 'en-US' : 'es-CR', {
    timeZone: 'America/Costa_Rica',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ReservasPage() {
  const { t, i18n } = useTranslation();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoReserva | ''>('');
  const [vista, setVista] = useVistaPreferida('reservas');
  const [reservaACancelar, setReservaACancelar] = useState<Reserva | null>(null);

  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  const etiquetaEstado = useMemo(() => crearEtiquetaEstadoReserva(t), [t]);
  const opcionesEstado = useMemo(
    () => [
      { value: '', label: t('reservas.todosLosEstados') },
      { value: 'pendiente', label: etiquetaEstado.pendiente },
      { value: 'confirmada', label: etiquetaEstado.confirmada },
      { value: 'cancelada', label: etiquetaEstado.cancelada },
      { value: 'ausente', label: etiquetaEstado.ausente },
    ],
    [t, etiquetaEstado],
  );

  const reservasQuery = useQuery({
    queryKey: ['reservas-admin', pagina, estado],
    queryFn: () => reservasApi.listar({ page: pagina, limit: LIMITE, estado: estado || undefined }),
  });

  const cancelarMutation = useMutation({
    mutationFn: (idReserva: string) => reservasApi.cancelar(idReserva),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reservas-admin'] });
      mostrarToast({ variante: 'exito', titulo: t('reservas.reservaCancelada') });
      setReservaACancelar(null);
    },
    onError: (error) => {
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : t('reservas.errorCancelar'),
      });
    },
  });

  const totalPaginas = reservasQuery.data
    ? Math.max(1, Math.ceil(reservasQuery.data.total / LIMITE))
    : 1;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t('comun.reservas')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('reservas.subtitulo')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label={t('reservas.estado')}
              opciones={opcionesEstado}
              defaultValue={estado}
              onChange={(e) => {
                setPagina(1);
                setEstado(e.target.value as EstadoReserva | '');
              }}
              className="w-44"
            />
            <ToggleVista vista={vista} onCambiar={setVista} />
          </div>
        </div>

        <div className="mt-6">
          {reservasQuery.isPending &&
            (vista === 'cuadricula' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <SkeletonTable filas={6} columnas={5} />
            ))}

          {reservasQuery.isError && <p className="text-sm text-danger">{t('reservas.error')}</p>}

          {reservasQuery.data?.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <CalendarX2
                className="h-8 w-8 text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('reservas.vacio')}</p>
            </div>
          )}

          {reservasQuery.data && reservasQuery.data.data.length > 0 && vista === 'cuadricula' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reservasQuery.data.data.map((reserva) => (
                <ReservaCard
                  key={reserva.idReserva}
                  reserva={reserva}
                  onCancelar={() => setReservaACancelar(reserva)}
                />
              ))}
            </div>
          )}

          {reservasQuery.data && reservasQuery.data.data.length > 0 && vista === 'lista' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaCliente')}</th>
                    <th className="px-4 py-2 font-medium">{t('reservas.columnaServicio')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaFecha')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaEstado')}</th>
                    <th className="px-4 py-2 font-medium text-right">
                      {t('reservas.columnaAcciones')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reservasQuery.data.data.map((reserva) => (
                    <tr key={reserva.idReserva} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {reserva.cliente?.nombreCompleto ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {reserva.servicio?.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatearFechaHora(reserva.fechaHoraInicio, i18n.language)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO[reserva.estado]}`}
                        >
                          {etiquetaEstado[reserva.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {reserva.estado !== 'cancelada' && (
                            <button
                              type="button"
                              onClick={() => setReservaACancelar(reserva)}
                              aria-label={t('reservas.cancelarAriaLabel', {
                                nombre: reserva.cliente?.nombreCompleto ?? '',
                              })}
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-danger dark:text-slate-400 dark:hover:bg-slate-700"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reservasQuery.data && totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                {t('comun.anterior')}
              </Boton>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('comun.paginaDe', { actual: pagina, total: totalPaginas })}
              </span>
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                {t('comun.siguiente')}
              </Boton>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        abierto={reservaACancelar !== null}
        titulo={t('reservas.cancelarReserva')}
        descripcion={t('reservas.confirmarCancelarDescripcion', {
          nombre: reservaACancelar?.cliente?.nombreCompleto ?? '',
        })}
        onCancelar={() => setReservaACancelar(null)}
        onConfirmar={() => reservaACancelar && cancelarMutation.mutate(reservaACancelar.idReserva)}
        cargando={cancelarMutation.isPending}
      />
    </AppLayout>
  );
}

function ReservaCard({ reserva, onCancelar }: { reserva: Reserva; onCancelar: () => void }) {
  const { t, i18n } = useTranslation();
  const etiquetaEstado = useMemo(() => crearEtiquetaEstadoReserva(t), [t]);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
            {reserva.cliente?.nombreCompleto ?? '—'}
          </p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {reserva.servicio?.nombre ?? '—'}
          </p>
        </div>
        {reserva.estado !== 'cancelada' && (
          <button
            type="button"
            onClick={onCancelar}
            aria-label={t('reservas.cancelarAriaLabel', {
              nombre: reserva.cliente?.nombreCompleto ?? '',
            })}
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-danger dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {formatearFechaHora(reserva.fechaHoraInicio, i18n.language)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO[reserva.estado]}`}
        >
          {etiquetaEstado[reserva.estado]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <User className="h-3 w-3" aria-hidden="true" />
          {reserva.usuario?.nombreCompleto ?? '—'}
        </span>
      </div>
    </div>
  );
}
