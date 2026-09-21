import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

/** Pantalla completa mientras se resuelve la sesión (restaurar tokens, /auth/me) — evita un parpadeo a /login en cada recarga. */
export function PantallaCargando() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
      <Loader2
        className="h-6 w-6 animate-spin text-primary-600"
        aria-label={t('comun.cargandoSesion')}
      />
    </div>
  );
}
