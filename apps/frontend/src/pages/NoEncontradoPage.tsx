import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Boton } from '@/components/ui';
import { useTituloPagina } from '@/lib/use-titulo-pagina';

export default function NoEncontradoPage() {
  const { t } = useTranslation();
  useTituloPagina(t('titulos.noEncontrado'));

  return (
    <main
      role="main"
      className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-900"
    >
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-800">
        <span className="text-5xl font-extrabold text-primary-600 dark:text-primary-400">404</span>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {t('errores.paginaNoEncontradaTitulo', 'Página no encontrada')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(
            'errores.paginaNoEncontradaDescripcion',
            'La dirección que buscas no existe o ha sido movida.',
          )}
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/">
            <Boton>{t('comun.volverAlInicio', 'Volver al inicio')}</Boton>
          </Link>
        </div>
      </div>
    </main>
  );
}
