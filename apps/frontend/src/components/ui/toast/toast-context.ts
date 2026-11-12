import { createContext, useContext } from 'react';
import type { VarianteFeedback } from '../feedback-variants';

/**
 * Contexto y hook del sistema de toasts, separados de `ToastProvider.tsx`
 * para que ese archivo solo exporte componentes (Fast Refresh de Vite:
 * regla `react-refresh/only-export-components`).
 */

export interface ToastItem {
  id: string;
  variante: VarianteFeedback;
  titulo: string;
  descripcion?: string;
}

export type MostrarToast = (toast: Omit<ToastItem, 'id'>) => void;

export const ToastContext = createContext<MostrarToast | null>(null);

/** Único punto de entrada para disparar un toast desde cualquier parte del sistema. */
export function useToast(): MostrarToast {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast() debe usarse dentro de <ToastProvider>');
  }
  return contexto;
}
