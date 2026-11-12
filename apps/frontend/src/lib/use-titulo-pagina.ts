import { useEffect } from 'react';

const MARCA = 'Turnify';

/** "Calendario · Turnify"; sin título, solo "Turnify". */
export function componerTitulo(titulo?: string | null): string {
  const limpio = titulo?.trim();
  return limpio ? `${limpio} · ${MARCA}` : MARCA;
}

/**
 * Título de la pestaña por pantalla (Bloque 1, punto 1.6). Cada pantalla lo
 * llama con su texto ya traducido (`t('titulos.…')`): al cambiar de idioma,
 * `t` devuelve el texto nuevo y el efecto actualiza el título, sin lógica
 * repetida por pantalla.
 */
export function useTituloPagina(titulo?: string | null): void {
  useEffect(() => {
    document.title = componerTitulo(titulo);
  }, [titulo]);
}
