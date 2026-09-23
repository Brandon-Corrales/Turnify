import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, Clock, Copy, Link2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, Select, useToast } from '@/components/ui';
import { SkeletonText } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { disponibilidadApi, type Disponibilidad } from '@/lib/disponibilidad-api';
import { negociosApi } from '@/lib/negocios-api';
import { usuariosApi } from '@/lib/usuarios-api';

const DIAS_CLAVE = [
  { valor: 0, clave: 'domingo' },
  { valor: 1, clave: 'lunes' },
  { valor: 2, clave: 'martes' },
  { valor: 3, clave: 'miercoles' },
  { valor: 4, clave: 'jueves' },
  { valor: 5, clave: 'viernes' },
  { valor: 6, clave: 'sabado' },
] as const;

function crearDias(t: TFunction) {
  return DIAS_CLAVE.map(({ valor, clave }) => ({ valor, etiqueta: t(`diaSemana.${clave}`) }));
}

const HORA_INICIO_DEFECTO = '09:00';
const HORA_FIN_DEFECTO = '18:00';

interface FilaDia {
  diaSemana: number;
  idDisponibilidad: string | null;
  activo: boolean;
  horaInicio: string;
  horaFin: string;
}

function filasIniciales(disponibilidad: Disponibilidad[]): FilaDia[] {
  return DIAS_CLAVE.map(({ valor }) => {
    // Un mismo día puede tener varias franjas (ej. mañana y tarde) — la
    // pantalla maneja UNA franja por día (el caso común); si hay más de
    // una, se muestra/edita la primera activa (o la primera que exista).
    const filas = disponibilidad
      .filter((d) => d.diaSemana === valor)
      .sort((a, b) => Number(b.activo) - Number(a.activo));
    const existente = filas[0];
    return {
      diaSemana: valor,
      idDisponibilidad: existente?.idDisponibilidad ?? null,
      activo: existente?.activo ?? false,
      horaInicio: existente?.horaInicio.slice(0, 5) ?? HORA_INICIO_DEFECTO,
      horaFin: existente?.horaFin.slice(0, 5) ?? HORA_FIN_DEFECTO,
    };
  });
}

/**
 * Configuración de horario laboral (punto 6 del brief, implícito en
 * "Calendario con datos reales de DISPONIBILIDAD"): la API de
 * Disponibilidad ya existía completa en el backend, pero no había
 * ninguna pantalla para que el propio negocio la definiera — sin esto,
 * un negocio nuevo no tiene ningún horario cargado y el wizard público
 * (y el propio Calendario) nunca pueden ofrecer un turno válido.
 *
 * Cada día se guarda solo (auto-save por fila) en vez de un botón
 * "Guardar todo": son 7 registros independientes en el backend, y
 * confirmar cada cambio al toque es más simple y menos propenso a
 * errores que rastrear qué filas quedaron "sucias" en un formulario
 * grande.
 */
export default function ConfiguracionPage() {
  const { t } = useTranslation();
  const { usuario } = useAuth();
  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  const dias = useMemo(() => crearDias(t), [t]);
  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });
  const usuariosQuery = useQuery({ queryKey: ['usuarios'], queryFn: usuariosApi.listar });
  const empleadosActivos = useMemo(
    () => usuariosQuery.data?.data.filter((u) => u.activo) ?? [],
    [usuariosQuery.data],
  );

  // Elegido manualmente (Select) o, sin elección, el propio usuario logueado
  // o el primer empleado activo — calculado directo en el render en vez de
  // sincronizado con un useEffect+setState (dispara re-renders en cascada).
  const [idUsuarioElegido, setIdUsuarioElegido] = useState<string>('');
  const idUsuarioSeleccionado =
    idUsuarioElegido || usuario?.idUsuario || empleadosActivos[0]?.idUsuario || '';

  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad', idUsuarioSeleccionado],
    queryFn: () => disponibilidadApi.listar(idUsuarioSeleccionado),
    enabled: !!idUsuarioSeleccionado,
  });

  // Filas ya guardadas en el servidor (derivado puro, sin efecto). Mientras
  // el usuario escribe una hora antes de perder el foco, ese valor en
  // edición vive aparte en `borrador` — así no hace falta sincronizar
  // estado local con la query en un useEffect.
  const filasServidor = useMemo(
    () => (disponibilidadQuery.data ? filasIniciales(disponibilidadQuery.data) : []),
    [disponibilidadQuery.data],
  );
  const [borrador, setBorrador] = useState<
    Record<number, Partial<Pick<FilaDia, 'horaInicio' | 'horaFin'>>>
  >({});
  const [activoOptimista, setActivoOptimista] = useState<Record<number, boolean>>({});
  const filas = filasServidor.map((fila) => ({
    ...fila,
    ...borrador[fila.diaSemana],
    activo: activoOptimista[fila.diaSemana] ?? fila.activo,
  }));

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['disponibilidad', idUsuarioSeleccionado] });

  const manejarError = (error: unknown, mensajePorDefecto: string) => {
    mostrarToast({
      variante: 'error',
      titulo: error instanceof ApiError ? error.message : mensajePorDefecto,
    });
  };

  const crearMutation = useMutation({
    mutationFn: disponibilidadApi.crear,
    onSuccess: () => {
      invalidar();
      mostrarToast({ variante: 'exito', titulo: t('configuracion.horarioActivado') });
    },
    onError: (error) => manejarError(error, t('configuracion.errorActivar')),
  });

  const actualizarMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof disponibilidadApi.actualizar>[1];
    }) => disponibilidadApi.actualizar(id, payload),
    onSuccess: () => invalidar(),
    onError: (error) => manejarError(error, t('configuracion.errorActualizar')),
  });

  const desactivarMutation = useMutation({
    mutationFn: disponibilidadApi.eliminar,
    onSuccess: () => {
      invalidar();
      mostrarToast({ variante: 'exito', titulo: t('configuracion.horarioDesactivado') });
    },
    onError: (error) => manejarError(error, t('configuracion.errorDesactivar')),
  });

  const alCambiarActivo = (fila: FilaDia, activo: boolean) => {
    setActivoOptimista((actual) => ({ ...actual, [fila.diaSemana]: activo }));
    const limpiarOptimista = () =>
      setActivoOptimista((actual) => {
        const resto = { ...actual };
        delete resto[fila.diaSemana];
        return resto;
      });
    const alTerminar = {
      onSuccess: async () => {
        await invalidar();
        limpiarOptimista();
      },
      onError: limpiarOptimista,
    };

    if (activo && !fila.idDisponibilidad) {
      crearMutation.mutate(
        {
          idUsuario: idUsuarioSeleccionado,
          diaSemana: fila.diaSemana,
          horaInicio: fila.horaInicio,
          horaFin: fila.horaFin,
        },
        alTerminar,
      );
      return;
    }
    if (fila.idDisponibilidad) {
      if (activo)
        actualizarMutation.mutate(
          { id: fila.idDisponibilidad, payload: { activo: true } },
          alTerminar,
        );
      else desactivarMutation.mutate(fila.idDisponibilidad, alTerminar);
    }
  };

  const alCambiarHora = (fila: FilaDia, campo: 'horaInicio' | 'horaFin', valor: string) => {
    setBorrador((actual) => ({
      ...actual,
      [fila.diaSemana]: { ...actual[fila.diaSemana], [campo]: valor },
    }));
  };

  const alGuardarHora = (fila: FilaDia) => {
    if (!fila.idDisponibilidad || !fila.activo) return;
    actualizarMutation.mutate(
      {
        id: fila.idDisponibilidad,
        payload: { horaInicio: fila.horaInicio, horaFin: fila.horaFin },
      },
      {
        onSuccess: () =>
          setBorrador((actual) => {
            const resto = { ...actual };
            delete resto[fila.diaSemana];
            return resto;
          }),
      },
    );
  };

  const [copiado, setCopiado] = useState(false);
  const linkReservaPublica = negocioQuery.data
    ? `${window.location.origin}/reservar/${negocioQuery.data.idNegocio}`
    : '';

  const copiarLinkReserva = async () => {
    try {
      await navigator.clipboard.writeText(linkReservaPublica);
      setCopiado(true);
      mostrarToast({ variante: 'exito', titulo: t('configuracion.linkCopiado') });
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      mostrarToast({ variante: 'error', titulo: t('configuracion.errorCopiarLink') });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {t('comun.configuracion')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('configuracion.subtitulo')}
        </p>

        {empleadosActivos.length > 1 && (
          <div className="mt-6 max-w-xs">
            <Select
              label={t('configuracion.empleado')}
              opciones={empleadosActivos.map((e) => ({
                value: e.idUsuario,
                label: e.nombreCompleto,
              }))}
              value={idUsuarioSeleccionado}
              onChange={(e) => setIdUsuarioElegido(e.target.value)}
            />
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <Link2 className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('configuracion.linkReservaTitulo')}
            </h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('configuracion.linkReservaDescripcion')}
            </p>
            {negocioQuery.isPending ? (
              <div className="mt-3">
                <SkeletonText lineas={1} />
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  readOnly
                  value={linkReservaPublica}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={t('configuracion.linkReservaAriaLabel')}
                  className="h-11 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                />
                <Boton
                  variante="secundario"
                  onClick={copiarLinkReserva}
                  className="shrink-0"
                  disabled={!linkReservaPublica}
                >
                  {copiado ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiado ? t('configuracion.copiado') : t('configuracion.copiarLink')}
                </Boton>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('configuracion.horarioSemanal')}
            </h2>
          </div>

          {disponibilidadQuery.isPending ? (
            <div className="p-5">
              <SkeletonText lineas={7} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filas.map((fila) => (
                <li
                  key={fila.diaSemana}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex min-w-[9rem] items-center gap-3">
                    <input
                      type="checkbox"
                      checked={fila.activo}
                      onChange={(e) => alCambiarActivo(fila, e.target.checked)}
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {dias.find((d) => d.valor === fila.diaSemana)?.etiqueta}
                    </span>
                  </label>

                  {fila.activo ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={fila.horaInicio}
                        onChange={(e) => alCambiarHora(fila, 'horaInicio', e.target.value)}
                        onBlur={() => alGuardarHora(fila)}
                        aria-label={t('configuracion.horaInicioAriaLabel', {
                          dia: dias.find((d) => d.valor === fila.diaSemana)?.etiqueta,
                        })}
                        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <span className="text-sm text-slate-400">
                        {t('configuracion.separadorHoras')}
                      </span>
                      <input
                        type="time"
                        value={fila.horaFin}
                        onChange={(e) => alCambiarHora(fila, 'horaFin', e.target.value)}
                        onBlur={() => alGuardarHora(fila)}
                        aria-label={t('configuracion.horaFinAriaLabel', {
                          dia: dias.find((d) => d.valor === fila.diaSemana)?.etiqueta,
                        })}
                        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      {t('configuracion.cerrado')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
