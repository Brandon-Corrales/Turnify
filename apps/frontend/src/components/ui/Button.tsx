import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type VarianteBoton = 'primario' | 'secundario' | 'destructivo' | 'icono';
export type TamanoBoton = 'sm' | 'md' | 'lg';

const CLASES_VARIANTE: Record<VarianteBoton, string> = {
  primario:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600 disabled:bg-primary-300',
  secundario:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:outline-primary-600 disabled:text-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700',
  destructivo:
    'bg-danger text-white hover:bg-red-700 focus-visible:outline-danger disabled:bg-red-300',
  icono:
    'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-primary-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
};

// Alto mínimo 44px en sm/md (Ley de Fitts, punto 12): zona de toque cómoda en mobile.
const CLASES_TAMANO: Record<VarianteBoton, Record<TamanoBoton, string>> = {
  primario: { sm: 'h-11 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-6 text-base' },
  secundario: { sm: 'h-11 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-6 text-base' },
  destructivo: { sm: 'h-11 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-6 text-base' },
  icono: { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' },
};

export interface BotonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof HTMLMotionProps<'button'>>,
    Omit<HTMLMotionProps<'button'>, 'children'> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  cargando?: boolean;
  children?: ReactNode;
}

/**
 * Único componente de botón para todo el sistema (punto 7 del brief):
 * primario/secundario/destructivo/ícono, con estados default/hover/
 * disabled/loading ya resueltos aquí, no reinventados por pantalla.
 */
export const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  (
    {
      variante = 'primario',
      tamano = 'md',
      cargando = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        whileHover={{ scale: disabled || cargando ? 1 : 1.02 }}
        whileTap={{ scale: disabled || cargando ? 1 : 0.98 }}
        transition={{ duration: 0.15 }}
        disabled={disabled || cargando}
        aria-busy={cargando}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed',
          CLASES_VARIANTE[variante],
          CLASES_TAMANO[variante][tamano],
          className,
        )}
        {...props}
      >
        {cargando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </motion.button>
    );
  },
);

Boton.displayName = 'Boton';
