import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, useToast } from '@/components/ui';
import { SkeletonText } from '@/components/ui/Skeleton';
import { TarjetasPlanes } from '@/components/suscripciones/TarjetasPlanes';
import { negociosApi } from '@/lib/negocios-api';
import { suscripcionesApi } from '@/lib/suscripciones-api';
import { ApiError } from '@/lib/api';

/**
 * Pantalla de upgrade de plan (Plan Gratis → Plan de Pago, punto 5.1 del
 * brief). Reusa `TarjetasPlanes` (misma comparación que la Landing
 * pública) — la única diferencia real es que el CTA del Plan de Pago
 * dispara un Stripe Checkout Session real (Test Mode) en vez de mandar a
 * /registro.
 */
export default function SuscripcionPage() {
  const { t } = useTranslation();
  const mostrarToast = useToast();

  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      suscripcionesApi.iniciarCheckout(
        `${window.location.origin}/suscripcion/exito`,
        `${window.location.origin}/suscripcion/cancelada`,
      ),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : t('suscripcion.errorCheckout'),
      });
    },
  });

  const esPlanGratis = negocioQuery.data?.planSuscripcion === 'gratis';

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('suscripcion.titulo')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('suscripcion.subtitulo')}
        </p>

        {negocioQuery.isPending ? (
          <SkeletonText lineas={6} className="mt-8" />
        ) : (
          <TarjetasPlanes
            planActual={esPlanGratis ? 'gratis' : 'pago'}
            ctaGratis={
              esPlanGratis ? (
                <Boton variante="secundario" className="w-full" disabled>
                  {t('suscripcion.tuPlanActual')}
                </Boton>
              ) : null
            }
            ctaPago={
              esPlanGratis ? (
                <Boton
                  className="w-full"
                  onClick={() => checkoutMutation.mutate()}
                  cargando={checkoutMutation.isPending}
                >
                  {t('suscripcion.botonActualizar')}
                </Boton>
              ) : (
                <Boton className="w-full" disabled>
                  {t('suscripcion.tuPlanActual')}
                </Boton>
              )
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
