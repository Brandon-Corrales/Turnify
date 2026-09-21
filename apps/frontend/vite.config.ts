import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Un solo .env para todo el monorepo (mismo criterio que el backend en
  // database/data-source.ts y app.module.ts). Vite solo expone al bundle
  // del navegador las variables prefijadas VITE_ — los secretos del
  // backend en ese mismo archivo (JWT, DB_PASSWORD, etc.) nunca llegan al
  // cliente, es un filtro propio de Vite, no algo que haya que replicar.
  envDir: path.resolve(import.meta.dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
