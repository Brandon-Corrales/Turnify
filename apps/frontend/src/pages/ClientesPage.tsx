import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, Pencil, Plus, Trash2, UserRound, UserRoundX } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Input, Modal, Select, ToggleVista, useToast } from '@/components/ui';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useVistaPreferida } from '@/lib/vista-preferida';
import { ApiError } from '@/lib/api';
import { crearClienteSchema, type ClienteFormValues } from '@/lib/validation';
import { clientesApi, type Cliente } from '@/lib/clientes-api';

const LIMITE = 12;

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
  const { t } = useTranslation();
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useVistaPreferida('clientes');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteADesactivar, setClienteADesactivar] = useState<Cliente | null>(null);

  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  const opcionesCanal = useMemo(
    () => [
      { value: 'email', label: t('clientes.opcionCanalEmail') },
      { value: 'whatsapp', label: t('clientes.opcionCanalWhatsapp') },
    ],
    [t],
  );
  const opcionesIdioma = useMemo(
    () => [
      { value: 'es', label: t('clientes.opcionIdiomaEs') },
      { value: 'en', label: t('clientes.opcionIdiomaEn') },
    ],
    [t],
  );
  const opcionesNivel = useMemo(
    () => [
      { value: 'gratis', label: t('clientes.opcionNivelGratis') },
      { value: 'premium', label: t('clientes.opcionNivelPremium') },
    ],
    [t],
  );

  const clientesQuery = useQuery({
    queryKey: ['clientes', pagina],
    queryFn: () => clientesApi.listar(pagina, LIMITE),
  });

  const clienteSchema = useMemo(() => crearClienteSchema(t), [t]);
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
        titulo: clienteEditando ? t('clientes.clienteActualizado') : t('clientes.clienteCreado'),
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
        titulo: error instanceof ApiError ? error.message : t('clientes.errorGuardar'),
      });
    },
  });

  const desactivarMutation = useMutation({
    mutationFn: (idCliente: string) => clientesApi.desactivar(idCliente),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      mostrarToast({ variante: 'exito', titulo: t('clientes.clienteDesactivado') });
      setClienteADesactivar(null);
    },
    onError: (error) => {
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : t('clientes.errorDesactivar'),
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t('comun.clientes')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('clientes.subtitulo')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleVista vista={vista} onCambiar={setVista} />
            <Boton onClick={abrirCrear}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('clientes.nuevoCliente')}
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

          {clientesQuery.isError && <p className="text-sm text-danger">{t('clientes.error')}</p>}

          {clientesQuery.data?.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
              <UserRound
                className="h-8 w-8 text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('clientes.vacio')}</p>
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
                    <th className="px-4 py-2 font-medium">{t('clientes.columnaNombre')}</th>
                    <th className="px-4 py-2 font-medium">{t('clientes.columnaCorreo')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaCanal')}</th>
                    <th className="px-4 py-2 font-medium">{t('clientes.columnaNivel')}</th>
                    <th className="px-4 py-2 font-medium">{t('notificaciones.columnaEstado')}</th>
                    <th className="px-4 py-2 font-medium text-right">
                      {t('reservas.columnaAcciones')}
                    </th>
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
                            aria-label={t('comun.editarAriaLabel', {
                              nombre: cliente.nombreCompleto,
                            })}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {cliente.activo && (
                            <button
                              type="button"
                              onClick={() => setClienteADesactivar(cliente)}
                              aria-label={t('comun.desactivarAriaLabel', {
                                nombre: cliente.nombreCompleto,
                              })}
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
                {t('comun.anterior')}
              </Boton>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('comun.paginaDe', { actual: pagina, total: totalPaginas })}
              </span>
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                {t('comun.siguiente')}
              </Boton>
            </div>
          )}
        </div>
      </div>

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={clienteEditando ? t('clientes.tituloEditar') : t('clientes.tituloNuevo')}
      >
        <form
          onSubmit={handleSubmit((valores) => guardarMutation.mutate(valores))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            label={t('clientes.nombreCompleto')}
            variante={clienteEditando ? 'editar' : 'crear'}
            requerido
            error={errors.nombreCompleto?.message}
            {...register('nombreCompleto')}
          />
          <Input
            label={t('comun.correoElectronico')}
            type="email"
            variante={clienteEditando ? 'editar' : 'crear'}
            requerido
            error={errors.correoElectronico?.message}
            {...register('correoElectronico')}
          />
          <Input
            label={t('clientes.telefono')}
            type="tel"
            variante={clienteEditando ? 'editar' : 'crear'}
            hint={t('comun.opcional')}
            error={errors.telefono?.message}
            {...register('telefono')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('clientes.canalPreferido')}
              variante={clienteEditando ? 'editar' : 'crear'}
              opciones={opcionesCanal}
              hint={t('clientes.hintCanalPreferido')}
              error={errors.canalPreferido?.message}
              {...register('canalPreferido')}
            />
            <Select
              label={t('clientes.idiomaPreferido')}
              variante={clienteEditando ? 'editar' : 'crear'}
              opciones={opcionesIdioma}
              error={errors.idiomaPreferido?.message}
              {...register('idiomaPreferido')}
            />
          </div>
          <Select
            label={t('clientes.nivelCliente')}
            variante={clienteEditando ? 'editar' : 'crear'}
            opciones={opcionesNivel}
            error={errors.nivelCliente?.message}
            {...register('nivelCliente')}
          />
          <Input
            label={t('clientes.notas')}
            variante={clienteEditando ? 'editar' : 'crear'}
            hint={t('comun.opcional')}
            error={errors.notas?.message}
            {...register('notas')}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              {t('comun.cancelar')}
            </Boton>
            <Boton type="submit" cargando={isSubmitting || guardarMutation.isPending}>
              {clienteEditando ? t('servicios.guardarCambios') : t('clientes.crearCliente')}
            </Boton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={clienteADesactivar !== null}
        titulo={t('clientes.confirmarDesactivarTitulo')}
        descripcion={t('clientes.confirmarDesactivarDescripcion', {
          nombre: clienteADesactivar?.nombreCompleto ?? '',
        })}
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
  const { t } = useTranslation();
  const Icono = canal === 'whatsapp' ? MessageCircle : Mail;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {canal === 'whatsapp'
        ? t('notificaciones.canalWhatsappCorto')
        : t('clientes.badgeCanalCorreo')}
    </span>
  );
}

function BadgeNivel({ nivel }: { nivel: Cliente['nivelCliente'] }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        nivel === 'premium'
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {nivel === 'premium' ? t('clientes.opcionNivelPremium') : t('clientes.opcionNivelGratis')}
    </span>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        activo
          ? 'bg-secondary-50 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
      }`}
    >
      {activo ? t('comun.activo') : t('comun.inactivo')}
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
  const { t } = useTranslation();
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
            aria-label={t('comun.editarAriaLabel', { nombre: cliente.nombreCompleto })}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          {cliente.activo && (
            <button
              type="button"
              onClick={onDesactivar}
              aria-label={t('comun.desactivarAriaLabel', { nombre: cliente.nombreCompleto })}
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
