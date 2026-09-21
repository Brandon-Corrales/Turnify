import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Select, useToast } from '@/components/ui';
import { SkeletonText } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { disponibilidadApi, type Disponibilidad } from '@/lib/disponibilidad-api';
import { usuariosApi } from '@/lib/usuarios-api';

const DIAS = [
  { valor: 0, etiqueta: 'Domingo' },
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
] as const;

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
  return DIAS.map(({ valor }) => {
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
  const { usuario } = useAuth();
  const mostrarToast = useToast();
  const queryClient = useQueryClient();

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
  const filas = filasServidor.map((fila) => ({ ...fila, ...borrador[fila.diaSemana] }));

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
      mostrarToast({ variante: 'exito', titulo: 'Horario activado' });
    },
    onError: (error) => manejarError(error, 'No se pudo activar ese día'),
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
    onError: (error) => manejarError(error, 'No se pudo actualizar ese horario'),
  });

  const desactivarMutation = useMutation({
    mutationFn: disponibilidadApi.eliminar,
    onSuccess: () => {
      invalidar();
      mostrarToast({ variante: 'exito', titulo: 'Horario desactivado' });
    },
    onError: (error) => manejarError(error, 'No se pudo desactivar ese día'),
  });

  const alCambiarActivo = (fila: FilaDia, activo: boolean) => {
    if (activo && !fila.idDisponibilidad) {
      crearMutation.mutate({
        idUsuario: idUsuarioSeleccionado,
        diaSemana: fila.diaSemana,
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
      });
      return;
    }
    if (fila.idDisponibilidad) {
      if (activo)
        actualizarMutation.mutate({ id: fila.idDisponibilidad, payload: { activo: true } });
      else desactivarMutation.mutate(fila.idDisponibilidad);
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Definí el horario laboral de tu negocio — las reservas (propias y las que hagan tus
          clientes por el enlace público) solo se pueden agendar dentro de estos horarios.
        </p>

        {empleadosActivos.length > 1 && (
          <div className="mt-6 max-w-xs">
            <Select
              label="Empleado"
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
            <Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Horario laboral semanal
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
                      {DIAS.find((d) => d.valor === fila.diaSemana)?.etiqueta}
                    </span>
                  </label>

                  {fila.activo ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={fila.horaInicio}
                        onChange={(e) => alCambiarHora(fila, 'horaInicio', e.target.value)}
                        onBlur={() => alGuardarHora(fila)}
                        aria-label={`Hora de inicio, ${DIAS.find((d) => d.valor === fila.diaSemana)?.etiqueta}`}
                        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <span className="text-sm text-slate-400">a</span>
                      <input
                        type="time"
                        value={fila.horaFin}
                        onChange={(e) => alCambiarHora(fila, 'horaFin', e.target.value)}
                        onBlur={() => alGuardarHora(fila)}
                        aria-label={`Hora de fin, ${DIAS.find((d) => d.valor === fila.diaSemana)?.etiqueta}`}
                        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">Cerrado</span>
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
