import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { useTema } from '@/lib/tema';

const IDIOMAS = [
  { codigo: 'es', etiqueta: 'ES' },
  { codigo: 'en', etiqueta: 'EN' },
] as const;

/**
 * Grupo de controles globales de preferencia (punto 9 del brief): tema
 * claro/oscuro e idioma, viviendo juntos con el mismo estilo visual de
 * píldora. La vista lista/cuadrícula (el tercer control del punto 9) vive
 * como su propio `<ToggleVista>` junto a cada listado (Clientes/Servicios/
 * Reservas) en vez de aquí — el punto 9 solo la exige "disponible en toda
 * pantalla que liste múltiples registros", y la mayoría de pantallas que
 * usan este navbar (Calendario, Reportes, formularios) no listan nada, así
 * que un control global fijo ahí sería un no-op confuso en esas pantallas.
 */
export function ControlesGlobales() {
  const { t, i18n } = useTranslation();
  const idiomaActual = i18n.language.startsWith('en') ? 'en' : 'es';
  const [tema, alternarTema] = useTema();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={alternarTema}
        aria-label={
          tema === 'oscuro' ? t('comun.cambiarATemaClaro') : t('comun.cambiarATemaOscuro')
        }
        aria-pressed={tema === 'oscuro'}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        {tema === 'oscuro' ? (
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
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
    </div>
  );
}
