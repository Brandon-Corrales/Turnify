import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleX } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton } from '@/components/ui';

/** Stripe redirige aquí si el usuario cierra/cancela el Checkout (Test Mode) — la URL exacta de `IniciarCheckoutDto.cancelUrl`. Ningún cambio de plan ocurrió. */
export default function SuscripcionCanceladaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center sm:px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <CircleX className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
          {t('suscripcion.canceladaTitulo')}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('suscripcion.canceladaDescripcion')}
        </p>
        <Boton className="mt-6" onClick={() => navigate('/suscripcion', { replace: true })}>
          {t('suscripcion.canceladaVolver')}
        </Boton>
      </div>
    </AppLayout>
  );
}
