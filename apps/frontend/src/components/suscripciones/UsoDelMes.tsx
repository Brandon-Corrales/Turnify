import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@/components/ui/Skeleton';
import { suscripcionesApi } from '@/lib/suscripciones-api';
import { resumirUso } from '@/lib/uso-plan';

/**
 * Uso del mes frente al límite del Plan Gratis (Bloque 4, punto 4.4). El
 * número sale de `GET /suscripciones/uso`, que usa el mismo conteo con el que
 * el backend bloquea la reserva 21: no puede diferir de lo que se aplica.
 */
export function UsoDelMes() {
  const { t } = useTranslation();
  const idTitulo = useId();
  const idAyuda = useId();
  const usoQuery = useQuery({
    queryKey: ['suscripciones', 'uso'],
    queryFn: suscripcionesApi.obtenerUso,
  });

  return (
    <section
      aria-labelledby={idTitulo}
      className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 id={idTitulo} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {t('suscripcion.usoTitulo')}
      </h2>

      {usoQuery.isPending && <SkeletonText lineas={2} className="mt-3" />}
      {usoQuery.isError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t('suscripcion.usoError')}
        </p>
      )}
      {usoQuery.data &&
        (() => {
          const uso = resumirUso(usoQuery.data);
          const texto =
            uso.limite === null
              ? t('suscripcion.usoReservasSinLimite', { usadas: uso.usadas })
              : t('suscripcion.usoReservas', { usadas: uso.usadas, limite: uso.limite });
          return (
            <>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{texto}</p>
              {uso.porcentaje !== null && (
                <div
                  role="progressbar"
                  aria-labelledby={idTitulo}
                  aria-describedby={idAyuda}
                  aria-valuemin={0}
                  aria-valuemax={uso.limite ?? undefined}
                  aria-valuenow={Math.min(uso.usadas, uso.limite ?? uso.usadas)}
                  aria-valuetext={texto}
                  className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                >
                  <div
                    className={`h-full rounded-full ${uso.alcanzado ? 'bg-warning' : 'bg-primary-600 dark:bg-primary-500'}`}
                    style={{ width: `${uso.porcentaje}%` }}
                  />
                </div>
              )}
              <p id={idAyuda} className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {uso.alcanzado ? t('suscripcion.usoAlcanzado') : t('suscripcion.usoAyuda')}
              </p>
            </>
          );
        })()}
    </section>
  );
}
