import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Input, Modal, ToggleVista, useToast } from '@/components/ui';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useVistaPreferida } from '@/lib/vista-preferida';
import { ApiError } from '@/lib/api';
import { servicioSchema, type ServicioFormValues } from '@/lib/validation';
import { serviciosApi, type Servicio } from '@/lib/servicios-api';

const LIMITE = 12;

const VALORES_VACIOS: ServicioFormValues = {
  nombre: '',
  descripcion: '',
  duracionMinutos: 30,
  precio: 0,
  colorCalendario: '#4f46e5',
};

function formatearPrecio(precio: string): string {
  const numero = Number(precio);
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0,
      })
    : precio;
}

export default function ServiciosPage() {
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useVistaPreferida('servicios');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [servicioEditando, setServicioEditando] = useState<Servicio | null>(null);
  const [servicioADesactivar, setServicioADesactivar] = useState<Servicio | null>(null);

  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  const serviciosQuery = useQuery({
    queryKey: ['servicios', pagina],
    queryFn: () => serviciosApi.listar(pagina, LIMITE),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServicioFormValues>({
    resolver: zodResolver(servicioSchema),
    defaultValues: VALORES_VACIOS,
  });

  const abrirCrear = () => {
    setServicioEditando(null);
    reset(VALORES_VACIOS);
    setModalAbierto(true);
  };

  const abrirEditar = (servicio: Servicio) => {
    setServicioEditando(servicio);
    reset({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      duracionMinutos: servicio.duracionMinutos,
      precio: Number(servicio.precio),
      colorCalendario: servicio.colorCalendario ?? '#4f46e5',
    });
    setModalAbierto(true);
  };

  const guardarMutation = useMutation({
    mutationFn: (valores: ServicioFormValues) => {
      const payload = { ...valores, descripcion: valores.descripcion || undefined };
      return servicioEditando
        ? serviciosApi.actualizar(servicioEditando.idServicio, payload)
        : serviciosApi.crear(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['servicios'] });
      mostrarToast({
        variante: 'exito',
        titulo: servicioEditando ? 'Servicio actualizado' : 'Servicio creado',
      });
      setModalAbierto(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field && error.errorCode === 'VALIDACION_FALLIDA') {
        setError(error.field as keyof ServicioFormValues, { message: error.message });
        return;
      }
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : 'No se pudo guardar el servicio',
      });
    },
  });

  const desactivarMutation = useMutation({
    mutationFn: (idServicio: string) => serviciosApi.desactivar(idServicio),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['servicios'] });
      mostrarToast({ variante: 'exito', titulo: 'Servicio desactivado' });
      setServicioADesactivar(null);
    },
    onError: (error) => {
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : 'No se pudo desactivar el servicio',
      });
    },
  });

  const totalPaginas = serviciosQuery.data
    ? Math.max(1, Math.ceil(serviciosQuery.data.total / LIMITE))
    : 1;

  const limiteAlcanzado =
    guardarMutation.error instanceof ApiError &&
    guardarMutation.error.errorCode === 'LIMITE_PLAN_ALCANZADO';

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Servicios</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Los servicios que ofrece tu negocio y su duración/precio.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleVista vista={vista} onCambiar={setVista} />
            <Boton onClick={abrirCrear}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo servicio
            </Boton>
          </div>
        </div>

        <div className="mt-6">
          {serviciosQuery.isPending &&
            (vista === 'cuadricula' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <SkeletonTable filas={6} columnas={4} />
            ))}

          {serviciosQuery.isError && (
            <p className="text-sm text-danger">No se pudo cargar la lista de servicios.</p>
          )}

          {serviciosQuery.data?.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <Tag className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todavía no tienes servicios registrados.
              </p>
            </div>
          )}

          {serviciosQuery.data && serviciosQuery.data.data.length > 0 && vista === 'cuadricula' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {serviciosQuery.data.data.map((servicio) => (
                <ServicioCard
                  key={servicio.idServicio}
                  servicio={servicio}
                  onEditar={() => abrirEditar(servicio)}
                  onDesactivar={() => setServicioADesactivar(servicio)}
                />
              ))}
            </div>
          )}

          {serviciosQuery.data && serviciosQuery.data.data.length > 0 && vista === 'lista' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Servicio</th>
                    <th className="px-4 py-2 font-medium">Duración</th>
                    <th className="px-4 py-2 font-medium">Precio</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {serviciosQuery.data.data.map((servicio) => (
                    <tr key={servicio.idServicio} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: servicio.colorCalendario || '#4f46e5' }}
                            aria-hidden="true"
                          />
                          {servicio.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {servicio.duracionMinutos} min
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatearPrecio(servicio.precio)}
                      </td>
                      <td className="px-4 py-3">
                        <BadgeEstado activo={servicio.activo} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditar(servicio)}
                            aria-label={`Editar ${servicio.nombre}`}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {servicio.activo && (
                            <button
                              type="button"
                              onClick={() => setServicioADesactivar(servicio)}
                              aria-label={`Desactivar ${servicio.nombre}`}
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-danger dark:text-slate-400 dark:hover:bg-slate-700"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {serviciosQuery.data && totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Boton>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Página {pagina} de {totalPaginas}
              </span>
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Boton>
            </div>
          )}
        </div>
      </div>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={servicioEditando ? 'Editar servicio' : 'Nuevo servicio'}
      >
        <form
          onSubmit={handleSubmit((valores) => guardarMutation.mutate(valores))}
          noValidate
          className="flex flex-col gap-4"
        >
          {limiteAlcanzado && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {guardarMutation.error instanceof Error ? guardarMutation.error.message : ''}
            </p>
          )}
          <Input
            label="Nombre del servicio"
            variante={servicioEditando ? 'editar' : 'crear'}
            requerido
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <Input
            label="Descripción"
            variante={servicioEditando ? 'editar' : 'crear'}
            hint="Opcional"
            error={errors.descripcion?.message}
            {...register('descripcion')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Duración (minutos)"
              type="number"
              min={1}
              max={1440}
              variante={servicioEditando ? 'editar' : 'crear'}
              requerido
              error={errors.duracionMinutos?.message}
              {...register('duracionMinutos', { valueAsNumber: true })}
            />
            <Input
              label="Precio (₡)"
              type="number"
              min={0}
              step="0.01"
              variante={servicioEditando ? 'editar' : 'crear'}
              requerido
              error={errors.precio?.message}
              {...register('precio', { valueAsNumber: true })}
            />
          </div>
          <Input
            label="Color en el calendario"
            type="color"
            variante={servicioEditando ? 'editar' : 'crear'}
            className="h-11 w-20 cursor-pointer p-1"
            error={errors.colorCalendario?.message}
            {...register('colorCalendario')}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={isSubmitting || guardarMutation.isPending}>
              {servicioEditando ? 'Guardar cambios' : 'Crear servicio'}
            </Boton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={servicioADesactivar !== null}
        titulo="Desactivar servicio"
        descripcion={`¿Seguro que deseas desactivar "${servicioADesactivar?.nombre}"? Ya no podrá reservarse, pero se conserva su historial.`}
        onCancelar={() => setServicioADesactivar(null)}
        onConfirmar={() =>
          servicioADesactivar && desactivarMutation.mutate(servicioADesactivar.idServicio)
        }
        cargando={desactivarMutation.isPending}
      />
    </AppLayout>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        activo
          ? 'bg-secondary-50 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
      }`}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function ServicioCard({
  servicio,
  onEditar,
  onDesactivar,
}: {
  servicio: Servicio;
  onEditar: () => void;
  onDesactivar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: servicio.colorCalendario || '#4f46e5' }}
            aria-hidden="true"
          />
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
            {servicio.nombre}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar ${servicio.nombre}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          {servicio.activo && (
            <button
              type="button"
              onClick={onDesactivar}
              aria-label={`Desactivar ${servicio.nombre}`}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-danger dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {servicio.descripcion && (
        <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {servicio.descripcion}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {servicio.duracionMinutos} min
        </span>
        <span className="font-medium">{formatearPrecio(servicio.precio)}</span>
        <BadgeEstado activo={servicio.activo} />
      </div>
    </div>
  );
}
