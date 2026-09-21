import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/** Bloque base: todo skeleton del sistema se compone a partir de este mismo átomo (punto 7). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('comun.cargando')}
      className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)}
      {...props}
    />
  );
}

/** Patrón de carga para texto (líneas de largo decreciente, se ve más natural que barras iguales). */
export function SkeletonText({ lineas = 3, className }: { lineas?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lineas }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lineas - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Patrón de carga para tarjeta (Dashboard, tarjeta de estadística, tarjeta de servicio/cliente). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lineas={2} />
    </div>
  );
}

/** Patrón de carga para tablas administrativas (Clientes, Servicios, Reservas). */
export function SkeletonTable({ filas = 5, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      {Array.from({ length: filas }).map((_, fila) => (
        <div
          key={fila}
          className="flex gap-4 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800"
        >
          {Array.from({ length: columnas }).map((_, columna) => (
            <Skeleton key={columna} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
