import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es.json';
import en from './locales/en.json';

/**
 * Punto 10 del brief: español por defecto (mercado objetivo Costa Rica),
 * inglés como segundo idioma. LanguageDetector primero mira localStorage
 * (`turnify_idioma`, elegido por el usuario vía el selector del navbar,
 * punto 9) y si no hay nada guardado cae al idioma del navegador — nunca
 * al revés, para que la elección explícita del usuario persista entre
 * sesiones sin que el navegador la pise.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'turnify_idioma',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

declare global {
  interface Window {
    /** API pública del widget de UserWay (cargado en index.html). */
    UserWay?: { changeWidgetLanguage?: (codigo: string) => void };
  }
}

/**
 * `<html lang>` sigue al idioma activo (al cargar y en cada cambio): lo
 * usan los lectores de pantalla para pronunciar y UserWay para el idioma
 * de su menú. UserWay solo lee `lang` al inicializarse (así lo documenta),
 * por eso en cada cambio también se le avisa con su API
 * `changeWidgetLanguage`. El valor inicial antes de que React cargue lo
 * pone el script inline de `index.html`.
 */
function sincronizarIdiomaDelDocumento() {
  const idioma = i18n.resolvedLanguage ?? 'es';
  document.documentElement.lang = idioma;
  window.UserWay?.changeWidgetLanguage?.(idioma);
}
sincronizarIdiomaDelDocumento();
i18n.on('languageChanged', sincronizarIdiomaDelDocumento);

export default i18n;
