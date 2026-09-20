import { useState } from 'react';

export type Vista = 'lista' | 'cuadricula';

/**
 * Punto 9 del brief: la preferencia de vista lista/cuadrícula se recuerda
 * POR PANTALLA (una clave de localStorage por pantalla, no una global) y
 * no se resetea al navegar. `clave` identifica la pantalla (p.ej.
 * "clientes", "servicios", "reservas").
 */
export function useVistaPreferida(clave: string, porDefecto: Vista = 'cuadricula') {
  const llave = `turnify_vista_${clave}`;
  const [vista, setVistaState] = useState<Vista>(() => {
    try {
      const guardada = localStorage.getItem(llave);
      return guardada === 'lista' || guardada === 'cuadricula' ? guardada : porDefecto;
    } catch {
      return porDefecto;
    }
  });

  const setVista = (nueva: Vista) => {
    setVistaState(nueva);
    try {
      localStorage.setItem(llave, nueva);
    } catch {
      // localStorage no disponible (modo privado, etc.) — la preferencia
      // simplemente no persiste entre sesiones, no rompe la pantalla.
    }
  };

  return [vista, setVista] as const;
}
