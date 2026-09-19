import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Boton, SkeletonText, useToast } from '@/components/ui';
import { negociosApi } from '@/lib/negocios-api';
import { plantillasServicioApi } from '@/lib/plantillas-servicio-api';
import { serviciosApi } from '@/lib/servicios-api';
import { ApiError } from '@/lib/api';
import { ETIQUETA_TIPO_NEGOCIO } from '@/lib/tipo-negocio';

/**
 * Precio sugerido de arranque para los servicios creados desde una
 * plantilla (punto 2 del brief: "valores por defecto que el admin edita
 * después"). No hay un precio real de referencia por vertical en el
 * catálogo estático, así que se usa un placeholder consistente en vez de
 * uno inventado por servicio.
 */
const PRECIO_SUGERIDO_DEFECTO = 5000;

/**
 * Paso de onboarding justo después del registro (punto 2 del brief): se
 * muestra una sola vez, antes del primer ingreso al dashboard. No es una
 * ruta que se vuelva a visitar — no hay guard que la bloquee tras
 * completarla, el usuario simplemente no vuelve a navegar aquí.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const mostrarToast = useToast();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data: negocio, isLoading: cargandoNegocio } = useQuery({
    queryKey: ['negocio-mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });

  const { data: plantillas = [], isLoading: cargandoPlantillas } = useQuery({
    queryKey: ['plantillas-servicio', negocio?.tipoNegocio],
    queryFn: () => plantillasServicioApi.listar(negocio!.tipoNegocio),
    enabled: Boolean(negocio) && negocio!.tipoNegocio !== 'otro',
  });

  const crearSeleccionados = useMutation({
    mutationFn: async () => {
      const elegidas = plantillas.filter((p) => seleccionados.has(p.idPlantilla));
      await Promise.all(
        elegidas.map((plantilla) =>
          serviciosApi.crear({
            nombre: plantilla.nombre,
            duracionMinutos: plantilla.duracionMinutosSugerida,
            precio: PRECIO_SUGERIDO_DEFECTO,
          }),
        ),
      );
    },
    onSuccess: () => {
      mostrarToast({
        variante: 'exito',
        titulo:
          seleccionados.size > 0
            ? `${seleccionados.size} servicio(s) creados`
            : 'Listo para empezar',
      });
      navigate('/', { replace: true });
    },
    onError: (error) => {
      const mensaje =
        error instanceof ApiError ? error.message : 'No se pudieron crear los servicios';
      mostrarToast({ variante: 'error', titulo: mensaje });
    },
  });

  const alternarSeleccion = (idPlantilla: string) => {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(idPlantilla)) nuevo.delete(idPlantilla);
      else nuevo.add(idPlantilla);
      return nuevo;
    });
  };

  const cargando = cargandoNegocio || (negocio?.tipoNegocio !== 'otro' && cargandoPlantillas);
  const sinPlantillas = negocio?.tipoNegocio === 'otro' || (!cargando && plantillas.length === 0);

  const etiquetaVertical = useMemo(
    () => (negocio ? ETIQUETA_TIPO_NEGOCIO[negocio.tipoNegocio] : ''),
    [negocio],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-2xl font-semibold text-primary-600 dark:text-primary-400">
          ¿Qué servicios ofreces?
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {negocio
            ? `Estas son sugerencias comunes para ${etiquetaVertical}. Puedes agregar más después.`
            : 'Cargando tu negocio…'}
        </p>

        <div className="mt-6">
          {cargando && <SkeletonText lineas={5} />}

          {!cargando && sinPlantillas && (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
              No hay plantillas sugeridas para tu tipo de negocio — puedes crear tus servicios desde
              cero cuando quieras.
            </p>
          )}

          {!cargando && !sinPlantillas && (
            <ul className="flex flex-col gap-2">
              {plantillas.map((plantilla) => (
                <li key={plantilla.idPlantilla}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(plantilla.idPlantilla)}
                      onChange={() => alternarSeleccion(plantilla.idPlantilla)}
                      className="h-4 w-4 rounded border-slate-300 text-secondary-600 focus:ring-secondary-500"
                    />
                    <span className="flex-1 text-slate-700 dark:text-slate-200">
                      {plantilla.nombre}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {plantilla.duracionMinutosSugerida} min
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Boton
          className="mt-6 w-full"
          cargando={crearSeleccionados.isPending}
          disabled={cargando}
          onClick={() => crearSeleccionados.mutate()}
        >
          {sinPlantillas || seleccionados.size === 0
            ? 'Continuar'
            : `Crear ${seleccionados.size} servicio(s) y continuar`}
        </Boton>
      </div>
    </div>
  );
}
