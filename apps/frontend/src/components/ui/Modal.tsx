import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  className?: string;
}

const SELECTOR_ENFOCABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Shell genérico de diálogo modal (punto 7): overlay + panel + cierre por
 * Escape/click afuera + trampa de foco por teclado (punto 10,
 * accesibilidad). ConfirmDialog se construye encima de este para el caso
 * específico de confirmar una acción destructiva.
 */
export function Modal({ abierto, onCerrar, titulo, children, className }: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    disparadorRef.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const enfocables = panelRef.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE);
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTecla);
      document.body.style.overflow = '';
      disparadorRef.current?.focus();
    };
  }, [abierto, onCerrar]);

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onCerrar}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-titulo"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800',
              className,
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2
                id="modal-titulo"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {titulo}
              </h2>
              <button
                type="button"
                onClick={onCerrar}
                aria-label={t('comun.cerrar')}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
