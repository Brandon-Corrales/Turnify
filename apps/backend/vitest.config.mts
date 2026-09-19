import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest en vez de Jest: NestJS 12 se publica ESM-only y Jest todavía no
 * sabe hacer require(esm) nativo (eso llega en Node 24.9+). Vitest corre
 * sobre Vite, que maneja ESM de forma nativa, así que no hay conflicto.
 *
 * unplugin-swc (con decoratorMetadata:true en .swcrc) reemplaza la
 * transformación TS por defecto de Vitest (esbuild, que NO implementa
 * emitDecoratorMetadata) — necesario para que @nestjs/testing y la
 * inyección de dependencias de Nest funcionen igual que con tsc.
 */
export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
  },
  plugins: [swc.vite()],
});
