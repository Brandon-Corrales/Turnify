import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { CLASES_FOCO_VARIANTE, type VarianteCampo } from './campo-variante';

export interface OpcionSelect {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  opciones: OpcionSelect[];
  error?: string;
  hint?: string;
  requerido?: boolean;
  placeholder?: string;
  variante?: VarianteCampo;
}

/**
 * Contraparte de Input para listas fijas (punto 8 del brief): mismo
 * indicador de obligatorio, mismo estado de error y misma convención de
 * color de foco crear/editar, para no reinventar un `<select>` suelto por
 * pantalla.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, opciones, error, hint, requerido, variante, placeholder, id, className, ...props },
    ref,
  ) => {
    const idGenerado = useId();
    const selectId = id ?? idGenerado;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {requerido && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <select
          ref={ref}
          id={selectId}
          required={requerido}
          aria-required={requerido}
          aria-invalid={Boolean(error)}
          aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
          defaultValue={props.defaultValue ?? ''}
          className={cn(
            'h-11 rounded-md border bg-white px-3 text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
            'dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900',
            error
              ? 'border-danger focus:ring-danger'
              : cn(
                  'border-slate-300 dark:border-slate-600',
                  CLASES_FOCO_VARIANTE[variante ?? 'neutro'],
                ),
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {opciones.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';
