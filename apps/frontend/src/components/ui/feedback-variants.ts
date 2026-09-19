import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';

/**
 * Las 4 variantes de feedback exigidas por el punto 7 del brief (éxito,
 * error, advertencia, información), con el mismo color e ícono sin
 * importar si las usa Toast, Banner, o el borde de error de un Input —
 * un solo lugar para todo el sistema, no uno por componente.
 */
export type VarianteFeedback = 'exito' | 'error' | 'advertencia' | 'info';

interface ConfigVariante {
  icon: LucideIcon;
  claseTexto: string;
  claseFondo: string;
  claseBorde: string;
}

export const CONFIG_VARIANTE: Record<VarianteFeedback, ConfigVariante> = {
  exito: {
    icon: CheckCircle2,
    claseTexto: 'text-success dark:text-secondary-400',
    claseFondo: 'bg-secondary-50 dark:bg-secondary-900/30',
    claseBorde: 'border-secondary-200 dark:border-secondary-800',
  },
  error: {
    icon: XCircle,
    claseTexto: 'text-danger dark:text-red-400',
    claseFondo: 'bg-red-50 dark:bg-red-900/30',
    claseBorde: 'border-red-200 dark:border-red-800',
  },
  advertencia: {
    icon: AlertTriangle,
    claseTexto: 'text-warning dark:text-amber-400',
    claseFondo: 'bg-amber-50 dark:bg-amber-900/30',
    claseBorde: 'border-amber-200 dark:border-amber-800',
  },
  info: {
    icon: Info,
    claseTexto: 'text-info dark:text-blue-400',
    claseFondo: 'bg-blue-50 dark:bg-blue-900/30',
    claseBorde: 'border-blue-200 dark:border-blue-800',
  },
};
