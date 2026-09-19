import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CONFIG_VARIANTE, type VarianteFeedback } from '../feedback-variants';

export interface ToastItem {
  id: string;
  variante: VarianteFeedback;
  titulo: string;
  descripcion?: string;
}

type MostrarToast = (toast: Omit<ToastItem, 'id'>) => void;

const ToastContext = createContext<MostrarToast | null>(null);

/** Misma duración para todo el sistema (punto 7 del brief): 5s, salvo error, que da más tiempo a leer. */
const DURACION_MS: Record<VarianteFeedback, number> = {
  exito: 4000,
  info: 4000,
  advertencia: 5000,
  error: 6000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remover = useCallback((id: string) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback<MostrarToast>(
    (toast) => {
      const id = crypto.randomUUID();
      setToasts((actuales) => [...actuales, { ...toast, id }]);
      window.setTimeout(() => remover(id), DURACION_MS[toast.variante]);
    },
    [remover],
  );

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onCerrar={() => remover(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onCerrar }: { toast: ToastItem; onCerrar: () => void }) {
  const { icon: Icon, claseTexto, claseFondo, claseBorde } = CONFIG_VARIANTE[toast.variante];

  return (
    <motion.div
      role="status"
      layout
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm',
        claseFondo,
        claseBorde,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', claseTexto)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{toast.titulo}</p>
        {toast.descripcion && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{toast.descripcion}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** Único punto de entrada para disparar un toast desde cualquier parte del sistema. */
export function useToast(): MostrarToast {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast() debe usarse dentro de <ToastProvider>');
  }
  return contexto;
}

// Reexport para que los consumidores no necesiten importar desde feedback-variants directamente.
export type { VarianteFeedback };
