import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { CLASES_FOCO_VARIANTE, type VarianteCampo } from './campo-variante';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  requerido?: boolean;
  /**
   * Convención obligatoria del punto 8 del brief: el foco indica por color
   * si el formulario crea (verde) o edita (azul) un registro. Sin variante,
   * usa el foco neutro (indigo) — para formularios que no son de
   * crear/editar un registro, como Login.
   */
  variante?: VarianteCampo;
}

/**
 * Único componente de campo de texto para todo el sistema (punto 7):
 * mismo indicador de obligatorio (asterisco rojo), mismo estado de error
 * (borde rojo + mensaje debajo, ligado con aria-describedby) sin importar
 * en qué formulario esté — nunca reinventado por pantalla.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, requerido, variante, id, className, ...props }, ref) => {
    const idGenerado = useId();
    const inputId = id ?? idGenerado;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {requerido && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={inputId}
          required={requerido}
          aria-required={requerido}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
          className={cn(
            'h-11 rounded-md border px-3 text-sm text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
            'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900',
            error
              ? 'border-danger focus:ring-danger'
              : cn(
                  'border-slate-300 dark:border-slate-600',
                  CLASES_FOCO_VARIANTE[variante ?? 'neutro'],
                ),
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-sm text-slate-500 dark:text-slate-400">
              {hint}
            </p>
          )
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
