import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, Check, Clock, Mail, MessageCircle, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { negociosApi } from '@/lib/negocios-api';
import {
  notificacionesApi,
  type CanalNotificacion,
  type EstadoNotificacion,
  type TipoNotificacion,
} from '@/lib/notificaciones-api';

const CLAVE_I18N_TIPO: Record<TipoNotificacion, string> = {
  confirmacion: 'notificaciones.tipoConfirmacion',
  cancelacion: 'notificaciones.tipoCancelacion',
  recordatorio: 'notificaciones.tipoRecordatorio',
};

const CLAVE_I18N_CANAL: Record<CanalNotificacion, string> = {
  email: 'notificaciones.canalEmail',
  whatsapp: 'notificaciones.canalWhatsappCorto',
  sms: 'notificaciones.canalSms',
};

const CLAVE_I18N_ESTADO: Record<EstadoNotificacion, string> = {
  enviada: 'notificaciones.estadoEnviada',
  pendiente: 'notificaciones.estadoPendiente',
  fallida: 'notificaciones.estadoFallida',
};

const ICONO_CANAL: Record<CanalNotificacion, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: MessageCircle,
};

const ESTILO_ESTADO: Record<EstadoNotificacion, string> = {
  enviada: 'bg-secondary-50 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
  pendiente: 'bg-amber-50 text-warning dark:bg-amber-900/30 dark:text-amber-400',
  fallida: 'bg-red-50 text-danger dark:bg-red-900/30 dark:text-red-400',
};

const ICONO_ESTADO: Record<EstadoNotificacion, typeof Check> = {
  enviada: Check,
  pendiente: Clock,
  fallida: X,
};

function formatearFechaHora(iso: string, idioma: string): string {
  return new Date(iso).toLocaleString(idioma.startsWith('en') ? 'en-US' : 'es-CR', {
    timeZone: 'America/Costa_Rica',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function NotificacionesPage() {
  const { t, i18n } = useTranslation();
  const [pagina, setPagina] = useState(1);
  const LIMITE = 15;

  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });

  const notificacionesQuery = useQuery({
    queryKey: ['notificaciones', pagina],
    queryFn: () => notificacionesApi.listar(pagina, LIMITE),
  });

  const whatsappHabilitado = negocioQuery.data?.planSuscripcion !== 'gratis';
  const totalPaginas = notificacionesQuery.data
    ? Math.max(1, Math.ceil(notificacionesQuery.data.total / LIMITE))
    : 1;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('notificaciones.titulo')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('notificaciones.subtitulo')}
        </p>

        {/* Configuración de canales — reales, mismo criterio que aplica el backend */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('notificaciones.canalesTitulo')}
          </h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Mail
                className="h-4 w-4 text-secondary-600 dark:text-secondary-400"
                aria-hidden="true"
              />
              {t('notificaciones.canalCorreo')}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle
                className={
                  whatsappHabilitado
                    ? 'h-4 w-4 text-secondary-600 dark:text-secondary-400'
                    : 'h-4 w-4 text-slate-300 dark:text-slate-600'
                }
                aria-hidden="true"
              />
              <span
                className={
                  whatsappHabilitado
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-600'
                }
              >
                {t('notificaciones.canalWhatsapp')}{' '}
                {whatsappHabilitado
                  ? t('notificaciones.whatsappDisponible')
                  : t('notificaciones.whatsappNoDisponible')}
              </span>
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="mt-6">
          {notificacionesQuery.isPending && <SkeletonTable filas={6} columnas={5} />}

          {notificacionesQuery.isError && (
            <p className="text-sm text-danger">{t('notificaciones.error')}</p>
          )}

          {notificacionesQuery.data?.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <Bell className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('notificaciones.vacio')}
              </p>
            </div>
          )}

          {notificacionesQuery.data && notificacionesQuery.data.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaCliente')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaTipo')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaCanal')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaEstado')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaFecha')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notificacionesQuery.data.data.map((n) => {
                    const IconoCanal = ICONO_CANAL[n.canal];
                    const IconoEstado = ICONO_ESTADO[n.estado];
                    return (
                      <tr key={n.idNotificacion} className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {n.cliente.nombreCompleto}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {t(CLAVE_I18N_TIPO[n.tipo])}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <IconoCanal className="h-3.5 w-3.5" aria-hidden="true" />
                            {t(CLAVE_I18N_CANAL[n.canal])}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO[n.estado]}`}
                          >
                            <IconoEstado className="h-3 w-3" aria-hidden="true" />
                            {t(CLAVE_I18N_ESTADO[n.estado])}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {formatearFechaHora(n.enviadoEn ?? n.programadoPara, i18n.language)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {notificacionesQuery.data && totalPaginas > 1 && (
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
    </AppLayout>
  );
}
