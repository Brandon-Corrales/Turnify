import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Boton, SkeletonText, useToast } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { zonaOPorDefecto } from '@/lib/fecha-negocio';
import { negociosApi } from '@/lib/negocios-api';
import { SelectorZonaHoraria } from './SelectorZonaHoraria';
import { SelectorMoneda } from './SelectorMoneda';
import { monedaOPorDefecto } from '@/lib/dinero';

/** Configuración → zona horaria (5.1) y moneda (5.2) del negocio. */
export function TarjetaPreferenciasRegionales() {
  const { t } = useTranslation();
  const mostrarToast = useToast();
  const queryClient = useQueryClient();
  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });
  const guardada = zonaOPorDefecto(negocioQuery.data?.zonaHoraria);
  const [zonaElegida, setZonaElegida] = useState<string | null>(null);
  const zona = zonaElegida ?? guardada;
  const monedaGuardada = monedaOPorDefecto(negocioQuery.data?.moneda);
  const [monedaElegida, setMonedaElegida] = useState<string | null>(null);
  const moneda = monedaElegida ?? monedaGuardada;
  const sinCambios = zona === guardada && moneda === monedaGuardada;

  const guardar = useMutation({
    mutationFn: () => negociosApi.actualizarMiNegocio({ zonaHoraria: zona, moneda }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['negocios', 'mi-negocio'] });
      setZonaElegida(null);
      setMonedaElegida(null);
      mostrarToast({ variante: 'exito', titulo: t('negocio.guardado') });
    },
    onError: (error) =>
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : t('negocio.errorGuardar'),
      }),
  });

  return (
    <section
      aria-labelledby="titulo-preferencias-regionales"
      className="mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <Globe className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        <h2
          id="titulo-preferencias-regionales"
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {t('negocio.preferenciasTitulo')}
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {negocioQuery.isPending ? (
          <SkeletonText lineas={2} />
        ) : (
          <>
            <SelectorZonaHoraria
              value={zona}
              onChange={setZonaElegida}
              hint={t('negocio.zonaHorariaAyudaCambio')}
            />
            <SelectorMoneda
              value={moneda}
              onChange={setMonedaElegida}
              hint={t('negocio.monedaAyuda')}
            />
            <div>
              <Boton
                onClick={() => guardar.mutate()}
                cargando={guardar.isPending}
                disabled={sinCambios}
              >
                {t('negocio.guardar')}
              </Boton>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
