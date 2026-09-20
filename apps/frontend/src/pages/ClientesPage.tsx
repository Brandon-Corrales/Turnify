import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, Plus, Trash2, UserRound, UserRoundX } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Input, Modal, Select, ToggleVista, useToast } from '@/components/ui';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useVistaPreferida } from '@/lib/vista-preferida';
import { ApiError } from '@/lib/api';
import { clienteSchema, type ClienteFormValues } from '@/lib/validation';
import { clientesApi, type Cliente } from '@/lib/clientes-api';

const LIMITE = 12;

const OPCIONES_CANAL = [
  { value: 'email', label: 'Correo electrónico' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const OPCIONES_IDIOMA = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
];

const OPCIONES_NIVEL = [
  { value: 'gratis', label: 'Gratis' },
  { value: 'premium', label: 'Premium' },
];

const VALORES_VACIOS: ClienteFormValues = {
  nombreCompleto: '',
  correoElectronico: '',
  telefono: '',
  notas: '',
  canalPreferido: 'email',
  idiomaPreferido: 'es',
  nivelCliente: 'gratis',
};

export default function ClientesPage() {
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useVistaPreferida('clientes');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteADesactivar, setClienteADesactivar] = useState<Cliente | null>(null);

  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  const clientesQuery = useQuery({
    queryKey: ['clientes', pagina],
    queryFn: () => clientesApi.listar(pagina, LIMITE),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: VALORES_VACIOS,
  });

  const abrirCrear = () => {
    setClienteEditando(null);
    reset(VALORES_VACIOS);
    setModalAbierto(true);
  };

  const abrirEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    reset({
      nombreCompleto: cliente.nombreCompleto,
      correoElectronico: cliente.correoElectronico,
      telefono: cliente.telefono ?? '',
      notas: cliente.notas ?? '',
      canalPreferido: cliente.canalPreferido,
      idiomaPreferido: cliente.idiomaPreferido,
      nivelCliente: cliente.nivelCliente,
    });
    setModalAbierto(true);
  };

  const guardarMutation = useMutation({
    mutationFn: (valores: ClienteFormValues) => {
      const payload = {
        ...valores,
        telefono: valores.telefono || undefined,
        notas: valores.notas || undefined,
      };
      return clienteEditando
        ? clientesApi.actualizar(clienteEditando.idCliente, payload)
        : clientesApi.crear(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      mostrarToast({
        variante: 'exito',
        titulo: clienteEditando ? 'Cliente actualizado' : 'Cliente creado',
      });
      setModalAbierto(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field) {
        setError(error.field as keyof ClienteFormValues, { message: error.message });
        return;
      }
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : 'No se pudo guardar el cliente',
      });
    },
  });

  const desactivarMutation = useMutation({
    mutationFn: (idCliente: string) => clientesApi.desactivar(idCliente),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      mostrarToast({ variante: 'exito', titulo: 'Cliente desactivado' });
      setClienteADesactivar(null);
    },
    onError: (error) => {
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : 'No se pudo desactivar el cliente',
      });
    },
  });

  const totalPaginas = clientesQuery.data
    ? Math.max(1, Math.ceil(clientesQuery.data.total / LIMITE))
    : 1;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Clientes</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gestiona la base de clientes de tu negocio.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleVista vista={vista} onCambiar={setVista} />
            <Boton onClick={abrirCrear}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo cliente
            </Boton>
          </div>
        </div>

        <div className="mt-6">
          {clientesQuery.isPending &&
            (vista === 'cuadricula' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <SkeletonTable filas={6} columnas={5} />
            ))}

          {clientesQuery.isError && (
            <p className="text-sm text-danger">No se pudo cargar la lista de clientes.</p>
          )}

          {clientesQuery.data?.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <UserRound
                className="h-8 w-8 text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todavía no tienes clientes registrados.
              </p>
            </div>
          )}

          {clientesQuery.data && clientesQuery.data.data.length > 0 && vista === 'cuadricula' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clientesQuery.data.data.map((cliente) => (
                <ClienteCard
                  key={cliente.idCliente}
                  cliente={cliente}
                  onEditar={() => abrirEditar(cliente)}
                  onDesactivar={() => setClienteADesactivar(cliente)}
                />
              ))}
            </div>
          )}

          {clientesQuery.data && clientesQuery.data.data.length > 0 && vista === 'lista' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Correo</th>
                    <th className="px-4 py-2 font-medium">Canal</th>
                    <th className="px-4 py-2 font-medium">Nivel</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clientesQuery.data.data.map((cliente) => (
                    <tr key={cliente.idCliente} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {cliente.nombreCompleto}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {cliente.correoElectronico}
                      </td>
                      <td className="px-4 py-3">
                        <BadgeCanal canal={cliente.canalPreferido} />
                      </td>
                      <td className="px-4 py-3">
                        <BadgeNivel nivel={cliente.nivelCliente} />
                      </td>
                      <td className="px-4 py-3">
                        <BadgeEstado activo={cliente.activo} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditar(cliente)}
                            aria-label={`Editar ${cliente.nombreCompleto}`}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {cliente.activo && (
                            <button
                              type="button"
                              onClick={() => setClienteADesactivar(cliente)}
                              aria-label={`Desactivar ${cliente.nombreCompleto}`}
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

          {clientesQuery.data && totalPaginas > 1 && (
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
        titulo={clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}
      >
        <form
          onSubmit={handleSubmit((valores) => guardarMutation.mutate(valores))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            label="Nombre completo"
            variante={clienteEditando ? 'editar' : 'crear'}
            requerido
            error={errors.nombreCompleto?.message}
            {...register('nombreCompleto')}
          />
          <Input
            label="Correo electrónico"
            type="email"
            variante={clienteEditando ? 'editar' : 'crear'}
            requerido
            error={errors.correoElectronico?.message}
            {...register('correoElectronico')}
          />
          <Input
            label="Teléfono"
            type="tel"
            variante={clienteEditando ? 'editar' : 'crear'}
            hint="Opcional"
            error={errors.telefono?.message}
            {...register('telefono')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Canal preferido"
              variante={clienteEditando ? 'editar' : 'crear'}
              opciones={OPCIONES_CANAL}
              hint="WhatsApp requiere cliente Premium y Plan de Pago"
              error={errors.canalPreferido?.message}
              {...register('canalPreferido')}
            />
            <Select
              label="Idioma preferido"
              variante={clienteEditando ? 'editar' : 'crear'}
              opciones={OPCIONES_IDIOMA}
              error={errors.idiomaPreferido?.message}
              {...register('idiomaPreferido')}
            />
          </div>
          <Select
            label="Nivel de cliente"
            variante={clienteEditando ? 'editar' : 'crear'}
            opciones={OPCIONES_NIVEL}
            error={errors.nivelCliente?.message}
            {...register('nivelCliente')}
          />
          <Input
            label="Notas"
            variante={clienteEditando ? 'editar' : 'crear'}
            hint="Opcional"
            error={errors.notas?.message}
            {...register('notas')}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={isSubmitting || guardarMutation.isPending}>
              {clienteEditando ? 'Guardar cambios' : 'Crear cliente'}
            </Boton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={clienteADesactivar !== null}
        titulo="Desactivar cliente"
        descripcion={`¿Seguro que deseas desactivar a "${clienteADesactivar?.nombreCompleto}"? Su historial de reservas se conserva.`}
        onCancelar={() => setClienteADesactivar(null)}
        onConfirmar={() =>
          clienteADesactivar && desactivarMutation.mutate(clienteADesactivar.idCliente)
        }
        cargando={desactivarMutation.isPending}
      />
    </AppLayout>
  );
}

function BadgeCanal({ canal }: { canal: Cliente['canalPreferido'] }) {
  const Icono = canal === 'whatsapp' ? MessageCircle : Mail;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}
    </span>
  );
}

function BadgeNivel({ nivel }: { nivel: Cliente['nivelCliente'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        nivel === 'premium'
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {nivel === 'premium' ? 'Premium' : 'Gratis'}
    </span>
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

function ClienteCard({
  cliente,
  onEditar,
  onDesactivar,
}: {
  cliente: Cliente;
  onEditar: () => void;
  onDesactivar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
            {cliente.nombreCompleto}
          </p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {cliente.correoElectronico}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar ${cliente.nombreCompleto}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          {cliente.activo && (
            <button
              type="button"
              onClick={onDesactivar}
              aria-label={`Desactivar ${cliente.nombreCompleto}`}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-danger dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <UserRoundX className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BadgeNivel nivel={cliente.nivelCliente} />
        <BadgeEstado activo={cliente.activo} />
        <BadgeCanal canal={cliente.canalPreferido} />
      </div>
    </div>
  );
}
