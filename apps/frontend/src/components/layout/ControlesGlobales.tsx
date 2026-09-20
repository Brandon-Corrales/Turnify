import { useTranslation } from 'react-i18next';

const IDIOMAS = [
  { codigo: 'es', etiqueta: 'ES' },
  { codigo: 'en', etiqueta: 'EN' },
] as const;

/**
 * Grupo de controles globales de preferencia (punto 9 del brief): vista
 * lista/cuadrícula y tema claro/oscuro son tarjetas propias todavía no
 * construidas — este componente es el contenedor donde van a vivir junto
 * al selector de idioma, para no tener que reestructurar el navbar
 * cuando lleguen.
 */
export function ControlesGlobales() {
  const { i18n } = useTranslation();
  const idiomaActual = i18n.language.startsWith('en') ? 'en' : 'es';

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="flex items-center rounded-full border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {IDIOMAS.map(({ codigo, etiqueta }) => (
        <button
          key={codigo}
          type="button"
          onClick={() => i18n.changeLanguage(codigo)}
          aria-pressed={idiomaActual === codigo}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            idiomaActual === codigo
              ? 'bg-primary-600 text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
