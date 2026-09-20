import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'turnify_tema';

function preferenciaSistema(): Tema {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // localStorage no disponible — cae al valor por defecto de abajo.
  }
  return preferenciaSistema();
}

/**
 * Punto 9 del brief: tema claro/oscuro persistente, con el tema del
 * sistema operativo como valor por defecto SOLO la primera vez (antes de
 * que el usuario elija explícitamente). El `.dark` en <html> ya se aplica
 * de forma síncrona en index.html (evita parpadeo en la primera pintura);
 * este hook solo sincroniza React con ese mismo estado y persiste el
 * cambio cuando el usuario alterna el toggle.
 */
export function useTema() {
  const [tema, setTemaState] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
  }, [tema]);

  const alternar = () => {
    setTemaState((actual) => {
      const nuevo: Tema = actual === 'oscuro' ? 'claro' : 'oscuro';
      try {
        localStorage.setItem(CLAVE, nuevo);
      } catch {
        // La preferencia simplemente no persiste entre sesiones.
      }
      return nuevo;
    });
  };

  return [tema, alternar] as const;
}
