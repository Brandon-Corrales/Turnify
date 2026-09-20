import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { SkeletonText } from '@/components/ui/Skeleton';
import { suscripcionesApi } from '@/lib/suscripciones-api';

function ItemPlan({ incluido, texto }: { incluido: boolean; texto: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {incluido ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-600 dark:text-secondary-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
      )}
      <span
        className={
          incluido ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'
        }
      >
        {texto}
      </span>
    </li>
  );
}

export interface TarjetasPlanesProps {
  /** Botón/acción de la tarjeta del Plan Gratis (varía entre Landing y la pantalla de upgrade autenticada). */
  ctaGratis: ReactNode;
  /** Botón/acción de la tarjeta del Plan de Pago. */
  ctaPago: ReactNode;
  /** Si el visitante ya tiene un plan (pantalla `/suscripcion`), marca cuál con "Tu plan actual" en vez del badge de marketing. */
  planActual?: 'gratis' | 'pago';
}

/**
 * Comparación Plan Gratis / Plan de Pago (punto 5.1 del brief): un solo
 * componente para la Landing pública y la pantalla de upgrade autenticada
 * (`/suscripcion`) — mismos números reales (misma fuente que
 * `LimitePlanGratisGuard`, vía `GET /suscripciones/planes`), en vez de dos
 * copias del mismo listado que se desincronizarían si cambian los límites.
 */
export function TarjetasPlanes({ ctaGratis, ctaPago, planActual }: TarjetasPlanesProps) {
  const { t } = useTranslation();
  const {
    data: planes,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['suscripciones', 'planes'],
    queryFn: suscripcionesApi.obtenerPlanes,
  });

  return (
    <>
      {isError && (
        <p className="mt-2 text-center text-sm text-danger">{t('landing.planesError')}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Plan Gratis */}
        <div className="relative rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          {planActual === 'gratis' && (
            <span className="absolute -top-3 left-6 rounded-full bg-slate-600 px-3 py-0.5 text-xs font-medium text-white dark:bg-slate-500">
              {t('suscripcion.tuPlanActual')}
            </span>
          )}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('landing.planGratisTitulo')}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('landing.planGratisSubtitulo')}
          </p>
          <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">₡0</p>

          {isPending ? (
            <SkeletonText lineas={6} className="mt-6" />
          ) : (
            <ul className="mt-6 flex flex-col gap-2.5">
              <ItemPlan
                incluido
                texto={t('landing.planGratisUsuarios', { n: planes?.gratis.usuarios ?? 1 })}
              />
              <ItemPlan
                incluido
                texto={t('landing.planGratisServicios', { n: planes?.gratis.servicios ?? 3 })}
              />
              <ItemPlan
                incluido
                texto={t('landing.planGratisReservas', {
                  n: planes?.gratis.reservasPorMes ?? 20,
                })}
              />
              <ItemPlan
                incluido
                texto={t('landing.planGratisChatbot', {
                  n: planes?.gratis.mensajesChatbotPorDia ?? 10,
                })}
              />
              <ItemPlan incluido texto={t('landing.planGratisEmail')} />
              <ItemPlan incluido={false} texto={t('landing.planGratisWhatsapp')} />
              <ItemPlan incluido={false} texto={t('landing.planGratisMarca')} />
            </ul>
          )}

          <div className="mt-6">{ctaGratis}</div>
        </div>

        {/* Plan de Pago */}
        <div className="relative rounded-xl border-2 border-primary-600 bg-white p-6 dark:bg-slate-900">
          <span className="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-medium text-white">
            {planActual === 'pago' ? t('suscripcion.tuPlanActual') : t('landing.planPagoBadge')}
          </span>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('landing.planPagoTitulo')}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('landing.planPagoSubtitulo')}
          </p>
          <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
            {t('landing.planPagoCobro')}
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            <ItemPlan incluido texto={t('landing.planPagoUsuarios')} />
            <ItemPlan incluido texto={t('landing.planPagoServicios')} />
            <ItemPlan incluido texto={t('landing.planPagoReservas')} />
            <ItemPlan incluido texto={t('landing.planPagoChatbot')} />
            <ItemPlan incluido texto={t('landing.planPagoEmailWhatsapp')} />
            <ItemPlan incluido texto={t('landing.planPagoMarca')} />
          </ul>

          <div className="mt-6">{ctaPago}</div>
        </div>
      </div>
    </>
  );
}
