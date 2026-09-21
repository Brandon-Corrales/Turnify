import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de la aplicación completa (frontend real + backend real, nunca
 * mocks) — punto 19/QA del brief. Playwright, no Cypress: soporte nativo
 * de TypeScript sin config aparte (coherente con el resto del monorepo,
 * todo TS), corre headless de fábrica sin depender de Electron/una GUI
 * (más liviano en este entorno y en CI), auto-espera en cada acción en
 * vez de `cy.wait()`/reintentos manuales, y `webServer` admite arrancar
 * VARIOS procesos (frontend Y backend) desde un solo `playwright test`
 * — Cypress solo orquesta un servidor bajo prueba de forma nativa.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
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
      command: 'npm run dev',
      cwd: import.meta.dirname,
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run start:dev',
      cwd: '../backend',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
