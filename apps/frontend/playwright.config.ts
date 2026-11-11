import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

/**
 * E2E de la aplicación completa (frontend real + backend real, nunca
 * mocks) — punto 19/QA del brief. Playwright, no Cypress: soporte nativo
 * de TypeScript sin config aparte (coherente con el resto del monorepo,
 * todo TS), corre headless de fábrica sin depender de Electron/una GUI
 * (más liviano en este entorno y en CI), auto-espera en cada acción en
 * vez de `cy.wait()`/reintentos manuales, y `webServer` admite arrancar
 * VARIOS procesos (frontend Y backend) desde un solo `playwright test`
 * — Cypress solo orquesta un servidor bajo prueba de forma nativa.
 *
 * Base de datos (Bloque 6, punto 6.1): el E2E registra negocios y crea
 * reservas de verdad, así que SOLO corre contra el Postgres local de
 * pruebas (`TEST_DATABASE_URL`, host local obligatorio). Usa sus propios
 * puertos (backend 3100, frontend 5174) y nunca reutiliza un servidor ya
 * abierto: un backend de desarrollo en el 3000 apunta a la base del `.env`
 * (Supabase, producción). Correr con `npm run test:e2e`, que antes aplica
 * las migraciones en la base de pruebas.
 */

const RAIZ_MONOREPO = path.resolve(import.meta.dirname, '../..');
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const PUERTO_BACKEND = 3100;
const PUERTO_FRONTEND = 5174;
const API_URL = `http://localhost:${PUERTO_BACKEND}`;
const FRONTEND_URL = `http://localhost:${PUERTO_FRONTEND}`;

function exigirBaseDatosPruebasLocal(): URL {
  // loadEnv con prefijo '' lee el .env de la raíz y las variables del
  // proceso (estas ganan), sin copiarlas a process.env.
  const valor = loadEnv('test', RAIZ_MONOREPO, '').TEST_DATABASE_URL?.trim();
  const ayuda =
    'El E2E solo corre contra el Postgres local de pruebas: `npm run db:test:up` y ' +
    'TEST_DATABASE_URL=postgresql://turnify_test:turnify_test@localhost:5433/turnify_test (ver .env.example).';
  if (!valor) throw new Error(`[e2e] Falta la variable TEST_DATABASE_URL. ${ayuda}`);
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`[e2e] TEST_DATABASE_URL no es una URL válida. ${ayuda}`);
  }
  if (!HOSTS_LOCALES.has(url.hostname.toLowerCase())) {
    throw new Error(
      `[e2e] El host de TEST_DATABASE_URL ("${url.hostname}") no es local; se cancela. ${ayuda}`,
    );
  }
  return url;
}

const basePruebas = exigirBaseDatosPruebasLocal();

// El spec lee la URL del backend de aquí (los workers heredan el entorno).
process.env.PLAYWRIGHT_API_URL = API_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    // Ancla el locale del navegador a español: el wizard público ahora
    // sigue el idioma detectado (i18next-browser-languagedetector cae a
    // navigator.language sin preferencia guardada en localStorage), y
    // este spec verifica el texto en español. Sin esto, el locale por
    // defecto del Chromium de CI puede no ser 'es' y el test falla no
    // por un bug real sino porque la página renderiza en inglés.
    locale: 'es-CR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run dev -- --port ${PUERTO_FRONTEND}`,
      cwd: import.meta.dirname,
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      // Las variables del proceso ganan sobre el .env en Vite.
      env: { VITE_API_URL: API_URL },
    },
    {
      command: 'npm run start',
      cwd: path.resolve(import.meta.dirname, '../backend'),
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      // Mismo criterio que las pruebas de integración
      // (backend/src/test-utils/base-datos-pruebas.ts): DATABASE_URL vacía
      // para que no gane la de Supabase del .env, conexión por DB_*, y
      // claves de proveedores externos vacías (nada llega a Resend,
      // WhatsApp, Stripe ni Groq).
      env: {
        NODE_ENV: 'test',
        PORT: String(PUERTO_BACKEND),
        CORS_ORIGIN: FRONTEND_URL,
        DATABASE_URL: '',
        DB_HOST: basePruebas.hostname,
        DB_PORT: basePruebas.port || '5432',
        DB_USERNAME: decodeURIComponent(basePruebas.username),
        DB_PASSWORD: decodeURIComponent(basePruebas.password),
        DB_NAME: basePruebas.pathname.replace(/^\//, ''),
        RESEND_API_KEY: '',
        WHATSAPP_ACCESS_TOKEN: '',
        WHATSAPP_PHONE_NUMBER_ID: '',
        STRIPE_SECRET_KEY: '',
        STRIPE_WEBHOOK_SECRET: '',
        STRIPE_PRICE_ID_PLAN_PAGO: '',
        LLM_API_KEY: '',
      },
    },
  ],
});
