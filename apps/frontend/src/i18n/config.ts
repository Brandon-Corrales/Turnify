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

export default i18n;
