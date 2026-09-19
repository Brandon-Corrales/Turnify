import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CONFIG_VARIANTE, type VarianteFeedback } from './feedback-variants';

export interface BannerProps {
  variante: VarianteFeedback;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  onCerrar?: () => void;
  className?: string;
}

/**
 * Único componente de banner de estado del sistema (punto 7): suscripción
 * vencida, negocio inactivo, etc. — misma forma y ubicación (arriba del
 * contenido de la pantalla) en toda la aplicación, nunca un aviso
 * inventado ad-hoc por módulo.
 */
export function Banner({
  variante,
  titulo,
  descripcion,
  accion,
  onCerrar,
  className,
}: BannerProps) {
  const { icon: Icon, claseTexto, claseFondo, claseBorde } = CONFIG_VARIANTE[variante];

  return (
    <div
      role={variante === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        claseFondo,
        claseBorde,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', claseTexto)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{titulo}</p>
        {descripcion && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{descripcion}</p>
        )}
        {accion && <div className="mt-3">{accion}</div>}
      </div>
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
