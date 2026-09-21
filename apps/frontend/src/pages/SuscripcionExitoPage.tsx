import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PartyPopper } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton } from '@/components/ui';

/**
 * Stripe redirige aquí tras completar el Checkout (Test Mode) — la URL
 * exacta que espera `IniciarCheckoutDto.successUrl`. El webhook de Stripe
 * es quien de verdad activa el Plan de Pago (puede tardar unos segundos
 * más que este redirect); se invalidan las queries de negocio/suscripción
 * para que la próxima vista ya pida el estado fresco en vez de servir el
 * caché de "Plan Gratis" de antes del pago.
 */
export default function SuscripcionExitoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['negocios', 'mi-negocio'] });
    queryClient.invalidateQueries({ queryKey: ['suscripciones'] });
  }, [queryClient]);

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center sm:px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-50 text-secondary-600 dark:bg-secondary-900/40 dark:text-secondary-400">
          <PartyPopper className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
          {t('suscripcion.exitoTitulo')}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('suscripcion.exitoDescripcion')}
        </p>
        <Boton className="mt-6" onClick={() => navigate('/', { replace: true })}>
          {t('suscripcion.exitoVolver')}
        </Boton>
      </div>
    </AppLayout>
  );
}
