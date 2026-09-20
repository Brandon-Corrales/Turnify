import { LayoutGrid, List } from 'lucide-react';
import type { Vista } from '@/lib/vista-preferida';

export interface ToggleVistaProps {
  vista: Vista;
  onCambiar: (vista: Vista) => void;
}

/**
 * Toggle reutilizable de vista lista/cuadrícula (punto 9 del brief),
 * mismo estilo visual que `ControlesGlobales` (el selector de idioma) —
 * un solo componente para las 3 pantallas que lo necesitan (Clientes,
 * Servicios, Reservas), nunca reinventado por pantalla.
 */
export function ToggleVista({ vista, onCambiar }: ToggleVistaProps) {
  return (
    <div
      role="group"
      aria-label="Vista"
      className="flex items-center rounded-full border border-slate-200 p-0.5 dark:border-slate-700"
    >
      <button
        type="button"
        onClick={() => onCambiar('cuadricula')}
        aria-pressed={vista === 'cuadricula'}
        aria-label="Vista de cuadrícula"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          vista === 'cuadricula'
            ? 'bg-primary-600 text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onCambiar('lista')}
        aria-pressed={vista === 'lista'}
        aria-label="Vista de lista"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          vista === 'lista'
            ? 'bg-primary-600 text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
