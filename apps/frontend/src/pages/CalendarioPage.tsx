import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg } from '@fullcalendar/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Input, Modal, Select, useToast } from '@/components/ui';
import { crearEtiquetaEstadoReserva, reservasApi, type Reserva } from '@/lib/reservas-api';
import { disponibilidadApi } from '@/lib/disponibilidad-api';
import { usuariosApi } from '@/lib/usuarios-api';
import { clientesApi } from '@/lib/clientes-api';
import { serviciosApi } from '@/lib/servicios-api';
import { ApiError } from '@/lib/api';
import { crearNuevaReservaSchema, type NuevaReservaFormValues } from '@/lib/validation';

function formatearFechaLocal(fecha: Date): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function formatearHoraLocal(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

const HORA_DEFECTO_CLIC_EN_DIA = '09:00';

const PUNTO_QUIEBRE_MOBILE = 768;
const VISTAS_LISTA = new Set(['listWeek', 'listDay']);

// En mobile el toolbar de FullCalendar no envuelve sus botones — con los
// 3 grupos completos (nav + título + selector de vista) se desborda en
// pantallas angostas. Como la vista ya cambia sola según el ancho (abajo),
// el selector de vista es redundante en mobile: se quita en vez de dejar
// que el layout se rompa (punto 12 del brief: nunca scroll horizontal).
const TOOLBAR_DESKTOP = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,listWeek',
};
const TOOLBAR_MOBILE = { left: 'prev,next', center: 'title', right: 'today' };

interface RangoVisible {
  desde: string;
  hasta: string;
}

/**
 * Muestra reservas + disponibilidad, cancela y reprograma (arrastrar un
 * evento), y permite crear una reserva manualmente haciendo clic en un
 * espacio del calendario — para llamadas telefónicas o clientes que llegan
 * sin haber reservado antes por el enlace público. Reutiliza el mismo
 * `POST /reservas` del staff (ya valida disponibilidad, traslapes y el
 * límite de 20/mes del Plan Gratis), solo le falta la UI hasta ahora.
 */
export default function CalendarioPage() {
  const { t, i18n } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);
  const [rango, setRango] = useState<RangoVisible | null>(null);
  const [idUsuarioFiltro, setIdUsuarioFiltro] = useState('');
  const [reservaSeleccionada, setReservaSeleccionada] = useState<Reserva | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [modalNuevaReservaAbierto, setModalNuevaReservaAbierto] = useState(false);
  const mostrarToast = useToast();
  const queryClient = useQueryClient();

  // Ley de Jakob (punto 12): el calendario se comporta como Google
  // Calendar/Calendly — vista de mes en desktop, agenda en mobile, y
  // cambia sola si la ventana cruza el punto de quiebre (no solo al
  // cargar la página).
  useEffect(() => {
    function alCambiarTamano() {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      const esMobile = window.innerWidth < PUNTO_QUIEBRE_MOBILE;
      const esVistaLista = VISTAS_LISTA.has(api.view.type);
      if (esMobile && !esVistaLista) api.changeView('listWeek');
      else if (!esMobile && esVistaLista) api.changeView('dayGridMonth');
      api.setOption('headerToolbar', esMobile ? TOOLBAR_MOBILE : TOOLBAR_DESKTOP);
    }
    window.addEventListener('resize', alCambiarTamano);
    return () => window.removeEventListener('resize', alCambiarTamano);
  }, []);

  const { data: usuariosData } = useQuery({ queryKey: ['usuarios'], queryFn: usuariosApi.listar });
  const empleados = useMemo(() => usuariosData?.data ?? [], [usuariosData]);
  const empleadosActivos = useMemo(() => empleados.filter((e) => e.activo), [empleados]);

  // limit=100 alcanza para el <select> de la reserva manual, mismo criterio
  // que usuariosApi.listar() — no hace falta paginación completa aquí.
  const { data: clientesData } = useQuery({
    queryKey: ['clientes', 'para-select'],
    queryFn: () => clientesApi.listar(1, 100),
  });
  const clientesActivos = useMemo(
    () => (clientesData?.data ?? []).filter((c) => c.activo),
    [clientesData],
  );

  const { data: serviciosData } = useQuery({
    queryKey: ['servicios', 'para-select'],
    queryFn: () => serviciosApi.listar(1, 100),
  });
  const serviciosActivos = useMemo(
    () => (serviciosData?.data ?? []).filter((s) => s.activo),
    [serviciosData],
  );

  const { data: disponibilidad = [] } = useQuery({
    queryKey: ['disponibilidad'],
    queryFn: () => disponibilidadApi.listar(),
  });

  const {
    data: reservasData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['reservas', rango, idUsuarioFiltro],
    queryFn: () =>
      reservasApi.listar({
        desde: rango!.desde,
        hasta: rango!.hasta,
        idUsuario: idUsuarioFiltro || undefined,
      }),
    enabled: rango !== null,
  });

  const etiquetaEstadoReserva = useMemo(() => crearEtiquetaEstadoReserva(t), [t]);

  const renderizarEvento = useCallback((info: EventContentArg) => {
    const reserva = info.event.extendedProps.reserva as Reserva;
    const cancelada = reserva.estado === 'cancelada';
    const horaInicio = formatearHoraLocal(new Date(reserva.fechaHoraInicio));

    return (
      <div
        className={`flex min-w-0 items-center gap-1.5 rounded-md border-l-2 px-2 py-1 text-xs leading-5 ${
          cancelada
            ? 'bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300'
            : 'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100'
        }`}
        style={{ borderLeftColor: cancelada ? '#94a3b8' : (reserva.servicio?.colorCalendario ?? '#8b5cf6') }}
      >
        <span className="shrink-0 font-semibold">{horaInicio}</span>
        <span className="min-w-0 truncate">{t('calendario.citaProgramada')}</span>
      </div>
    );
  }, [t]);

  const eventos = useMemo(
    () =>
      (reservasData?.data ?? []).map((reserva) => {
        const cancelada = reserva.estado === 'cancelada';
        return {
          id: reserva.idReserva,
          // "(cancelada)" como texto explícito, no solo un estilo visual:
          // un line-through choca en especificidad con el CSS propio de
          // FullCalendar (.fc-event fuerza text-decoration:none) y además
          // un tachado puramente visual no lo transmite un lector de
          // pantalla — el texto sí, siempre.
          // El backend ya incluye clientes/servicios desactivados en el
          // historial (withDeleted), pero el fallback se deja igual —
          // nunca romper el calendario entero por un dato faltante.
          // Cliente primero (punto 6: lo más útil de un vistazo en la celda
          // angosta del mes es "quién reservó", no el servicio) — bug real
          // reportado probando la app: con varias reservas el mismo día, el
          // título se veía cortado a la mitad ("3 Corte Clásico - cliet").
          title: `${reserva.cliente?.nombreCompleto ?? t('calendario.clienteEliminado')} · ${reserva.servicio?.nombre ?? t('calendario.servicioEliminado')}${cancelada ? ` (${t('calendario.sufijoCancelada')})` : ''}`,
          start: reserva.fechaHoraInicio,
          end: reserva.fechaHoraFin,
          backgroundColor: cancelada ? '#94a3b8' : (reserva.servicio?.colorCalendario ?? '#4f46e5'),
          borderColor: 'transparent',
          // una reserva cancelada se puede seguir viendo (historial) pero no se arrastra ni se cancela de nuevo
          editable: !cancelada,
          classNames: cancelada ? ['opacity-70'] : [],
          extendedProps: { reserva },
        };
      }),
    [reservasData, t],
  );

  const businessHours = useMemo(
    () =>
      disponibilidad
        .filter((d) => d.activo && (!idUsuarioFiltro || d.idUsuario === idUsuarioFiltro))
        .map((d) => ({
          daysOfWeek: [d.diaSemana],
          startTime: d.horaInicio.slice(0, 5),
          endTime: d.horaFin.slice(0, 5),
        })),
    [disponibilidad, idUsuarioFiltro],
  );

  const alCambiarRangoVisible = useCallback((info: DatesSetArg) => {
    setRango({ desde: info.start.toISOString(), hasta: info.end.toISOString() });
  }, []);

  const alHacerClicEnEvento = useCallback((info: EventClickArg) => {
    setReservaSeleccionada(info.event.extendedProps.reserva as Reserva);
  }, []);

  const nuevaReservaSchema = useMemo(() => crearNuevaReservaSchema(t), [t]);
  const {
    register: registerNuevaReserva,
    handleSubmit: handleSubmitNuevaReserva,
    reset: resetNuevaReserva,
    setError: setErrorNuevaReserva,
    formState: { errors: erroresNuevaReserva, isSubmitting: enviandoNuevaReserva },
  } = useForm<NuevaReservaFormValues>({
    resolver: zodResolver(nuevaReservaSchema),
    defaultValues: {
      idCliente: '',
      idServicio: '',
      idUsuario: '',
      fecha: '',
      hora: HORA_DEFECTO_CLIC_EN_DIA,
      notas: '',
    },
  });

  // Abre el formulario de reserva manual precargado con una fecha/hora —
  // bug real reportado probando la app: "no me deja seleccionar dentro del
  // calendario para reservar". Se dispara tanto al hacer clic en un espacio
  // vacío del calendario (día del mes o franja de semana/día) como desde el
  // botón "Nueva reserva". En vista de mes o desde el botón no hay una hora
  // útil que precargar (allDay), así que se usa la hora por defecto y el
  // usuario la ajusta en el formulario.
  const abrirModalNuevaReserva = useCallback(
    (fecha: Date, allDay: boolean) => {
      resetNuevaReserva({
        idCliente: '',
        idServicio: '',
        idUsuario: idUsuarioFiltro || empleadosActivos[0]?.idUsuario || '',
        fecha: formatearFechaLocal(fecha),
        hora: allDay ? HORA_DEFECTO_CLIC_EN_DIA : formatearHoraLocal(fecha),
        notas: '',
      });
      setModalNuevaReservaAbierto(true);
    },
    [resetNuevaReserva, idUsuarioFiltro, empleadosActivos],
  );

  const alHacerClicEnFecha = useCallback(
    (info: DateClickArg) => abrirModalNuevaReserva(info.date, info.allDay),
    [abrirModalNuevaReserva],
  );

  const crearReservaMutation = useMutation({
    mutationFn: (valores: NuevaReservaFormValues) =>
      reservasApi.crear({
        idCliente: valores.idCliente,
        idServicio: valores.idServicio,
        idUsuario: valores.idUsuario,
        fechaHoraInicio: new Date(`${valores.fecha}T${valores.hora}`).toISOString(),
        notas: valores.notas || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reservas'] });
      mostrarToast({ variante: 'exito', titulo: t('calendario.reservaCreada') });
      setModalNuevaReservaAbierto(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field) {
        setErrorNuevaReserva(error.field as keyof NuevaReservaFormValues, {
          message: error.message,
        });
        return;
      }
      mostrarToast({
        variante: 'error',
        titulo: error instanceof ApiError ? error.message : t('calendario.errorCrear'),
      });
    },
  });

  const alArrastrarEvento = useCallback(
    async (info: EventDropArg) => {
      const reserva = info.event.extendedProps.reserva as Reserva;
      const nuevoInicio = info.event.start;
      if (!nuevoInicio) {
        info.revert();
        return;
      }
      try {
        await reservasApi.reprogramar(reserva.idReserva, {
          fechaHoraInicio: nuevoInicio.toISOString(),
        });
        mostrarToast({ variante: 'exito', titulo: t('calendario.reservaReprogramada') });
        queryClient.invalidateQueries({ queryKey: ['reservas'] });
      } catch (error) {
        info.revert();
        const mensaje =
          error instanceof ApiError ? error.message : t('calendario.errorReprogramar');
        mostrarToast({ variante: 'error', titulo: mensaje });
      }
    },
    [mostrarToast, queryClient, t],
  );

  const confirmarCancelacion = async () => {
    if (!reservaSeleccionada) return;
    try {
      await reservasApi.cancelar(reservaSeleccionada.idReserva);
      mostrarToast({ variante: 'exito', titulo: t('reservas.reservaCancelada') });
      await queryClient.invalidateQueries({ queryKey: ['reservas'] });
      setConfirmandoCancelar(false);
      setReservaSeleccionada(null);
    } catch (error) {
      const mensaje = error instanceof ApiError ? error.message : t('reservas.errorCancelar');
      mostrarToast({ variante: 'error', titulo: mensaje });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('comun.calendario')}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={idUsuarioFiltro}
              onChange={(evento) => setIdUsuarioFiltro(evento.target.value)}
              aria-label={t('calendario.filtrarPorEmpleado')}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t('calendario.todosLosEmpleados')}</option>
              {empleados.map((empleado) => (
                <option key={empleado.idUsuario} value={empleado.idUsuario}>
                  {empleado.nombreCompleto}
                </option>
              ))}
            </select>
            <Boton onClick={() => abrirModalNuevaReserva(new Date(), true)}>
              {t('calendario.nuevaReserva')}
            </Boton>
          </div>
        </div>

        {/*
          El calendario SIEMPRE se monta (nunca detrás de un isLoading):
          es el propio datesSet de FullCalendar el que fija `rango` y
          habilita la query de reservas — esconderlo detrás de un
          skeleton hasta que la query "cargue" sería un candado sin
          salida, ya que la query nunca se habilitaría. Solo el badge de
          "Actualizando…" refleja isFetching/isLoading.
        */}
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 dark:border-slate-700 dark:bg-slate-800">
          {(isLoading || isFetching) && (
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
              {t('calendario.actualizando')}
            </p>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={window.innerWidth < PUNTO_QUIEBRE_MOBILE ? 'listWeek' : 'dayGridMonth'}
            headerToolbar={
              window.innerWidth < PUNTO_QUIEBRE_MOBILE ? TOOLBAR_MOBILE : TOOLBAR_DESKTOP
            }
            // El propio chrome de FullCalendar (nombres de mes/día, botón
            // "Hoy", el popover "+N más") también es "contenido" — bug real
            // reportado probando la app (punto 4): sin esto quedaba en
            // español fijo aunque el resto del sistema cambiara a inglés.
            locale={i18n.language.startsWith('en') ? undefined : esLocale}
            height="auto"
            editable
            eventStartEditable
            eventDurationEditable={false}
            businessHours={businessHours.length > 0 ? businessHours : undefined}
            events={eventos}
            // Con varias reservas el mismo día, el mes ya no las apila todas
            // (se veían con el texto cortado a la mitad) — se limita a 2 y
            // el resto queda detrás de un enlace "+N más" nativo de
            // FullCalendar, que al abrirse muestra cada evento completo.
            dayMaxEvents={2}
            eventContent={renderizarEvento}
            datesSet={alCambiarRangoVisible}
            dateClick={alHacerClicEnFecha}
            eventClick={alHacerClicEnEvento}
            eventDrop={alArrastrarEvento}
          />
        </div>
      </div>

      <Modal
        abierto={reservaSeleccionada !== null && !confirmandoCancelar}
        onCerrar={() => setReservaSeleccionada(null)}
        titulo={t('calendario.detalleTitulo')}
      >
        {reservaSeleccionada && (
          <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-medium">{t('calendario.detalleCliente')}</span>{' '}
              {reservaSeleccionada.cliente?.nombreCompleto ?? t('calendario.clienteEliminado')}
            </p>
            <p>
              <span className="font-medium">{t('calendario.detalleServicio')}</span>{' '}
              {reservaSeleccionada.servicio?.nombre ?? t('calendario.servicioEliminado')}
            </p>
            <p>
              <span className="font-medium">{t('calendario.detalleAtiende')}</span>{' '}
              {reservaSeleccionada.usuario?.nombreCompleto ?? t('calendario.usuarioEliminado')}
            </p>
            <p>
              <span className="font-medium">{t('calendario.detalleHorario')}</span>{' '}
              {new Date(reservaSeleccionada.fechaHoraInicio).toLocaleString(
                i18n.language.startsWith('en') ? 'en-US' : 'es-CR',
                { dateStyle: 'medium', timeStyle: 'short' },
              )}
            </p>
            <p>
              <span className="font-medium">{t('calendario.detalleEstado')}</span>{' '}
              {etiquetaEstadoReserva[reservaSeleccionada.estado]}
            </p>
            {reservaSeleccionada.estado !== 'cancelada' && (
              <Boton
                variante="destructivo"
                className="mt-4"
                onClick={() => setConfirmandoCancelar(true)}
              >
                {t('reservas.cancelarReserva')}
              </Boton>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={confirmandoCancelar}
        titulo={t('calendario.confirmarCancelarTitulo')}
        descripcion={t('calendario.confirmarCancelarDescripcion')}
        onConfirmar={confirmarCancelacion}
        onCancelar={() => setConfirmandoCancelar(false)}
      />

      <Modal
        abierto={modalNuevaReservaAbierto}
        onCerrar={() => setModalNuevaReservaAbierto(false)}
        titulo={t('calendario.nuevaReserva')}
      >
        <form
          onSubmit={handleSubmitNuevaReserva((valores) => crearReservaMutation.mutate(valores))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Select
            label={t('calendario.campoCliente')}
            variante="crear"
            requerido
            placeholder={t('validacion.seleccionaCliente')}
            opciones={clientesActivos.map((c) => ({ value: c.idCliente, label: c.nombreCompleto }))}
            error={erroresNuevaReserva.idCliente?.message}
            {...registerNuevaReserva('idCliente')}
          />
          <Select
            label={t('calendario.campoServicio')}
            variante="crear"
            requerido
            placeholder={t('validacion.seleccionaServicio')}
            opciones={serviciosActivos.map((s) => ({ value: s.idServicio, label: s.nombre }))}
            error={erroresNuevaReserva.idServicio?.message}
            {...registerNuevaReserva('idServicio')}
          />
          <Select
            label={t('calendario.campoAtiende')}
            variante="crear"
            requerido
            placeholder={t('validacion.seleccionaEmpleado')}
            opciones={empleadosActivos.map((e) => ({
              value: e.idUsuario,
              label: e.nombreCompleto,
            }))}
            error={erroresNuevaReserva.idUsuario?.message}
            {...registerNuevaReserva('idUsuario')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('calendario.campoFecha')}
              type="date"
              variante="crear"
              requerido
              error={erroresNuevaReserva.fecha?.message}
              {...registerNuevaReserva('fecha')}
            />
            <Input
              label={t('calendario.campoHora')}
              type="time"
              variante="crear"
              requerido
              error={erroresNuevaReserva.hora?.message}
              {...registerNuevaReserva('hora')}
            />
          </div>
          <Input
            label={t('clientes.notas')}
            variante="crear"
            hint={t('comun.opcional')}
            error={erroresNuevaReserva.notas?.message}
            {...registerNuevaReserva('notas')}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Boton
              variante="secundario"
              type="button"
              onClick={() => setModalNuevaReservaAbierto(false)}
            >
              {t('comun.cancelar')}
            </Boton>
            <Boton type="submit" cargando={enviandoNuevaReserva || crearReservaMutation.isPending}>
              {t('calendario.crearReserva')}
            </Boton>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
