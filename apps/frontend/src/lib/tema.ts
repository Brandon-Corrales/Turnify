import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'turnify_tema';

function preferenciaSistema(): Tema {
  if (typeof window === 'undefined') return 'claro';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

function temaInicial(): Tema {
  try {
    const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE) : null;
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // localStorage no disponible — cae al valor por defecto de abajo.
  }
  return preferenciaSistema();
}

let temaActual: Tema = temaInicial();
const oyentes = new Set<(tema: Tema) => void>();

function notificar(nuevo: Tema) {
  temaActual = nuevo;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', nuevo === 'oscuro');
  }
  oyentes.forEach((cb) => cb(nuevo));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE && (e.newValue === 'claro' || e.newValue === 'oscuro')) {
      notificar(e.newValue);
    }
  });
}

/**
 * Punto 9 del brief: tema claro/oscuro persistente, con el tema del
 * sistema operativo como valor por defecto SOLO la primera vez (antes de
 * que el usuario elija explícitamente). El `.dark` en <html> ya se aplica
 * de forma síncrona en index.html (evita parpadeo en la primera pintura);
 * este hook sincroniza React con ese mismo estado y mantiene todos los
 * componentes que lo usen (header móvil, menú lateral, etc.) 100% sincronizados.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro';
    }
    return temaActual;
  });

  useEffect(() => {
    // Asegurar que la clase del documento coincida con el tema actual
    document.documentElement.classList.toggle('dark', temaActual === 'oscuro');
    oyentes.add(setTema);
    return () => {
      oyentes.delete(setTema);
    };
  }, []);

  const alternar = () => {
    const siguiente: Tema = temaActual === 'oscuro' ? 'claro' : 'oscuro';
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // La preferencia simplemente no persiste entre sesiones.
    }
    notificar(siguiente);
  };

  return [tema, alternar] as const;
}
