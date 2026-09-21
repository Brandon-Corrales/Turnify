import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Input, Modal, Select, useToast } from '@/components/ui';
import { reservasApi, type Reserva } from '@/lib/reservas-api';
import { disponibilidadApi } from '@/lib/disponibilidad-api';
import { usuariosApi } from '@/lib/usuarios-api';
import { clientesApi } from '@/lib/clientes-api';
import { serviciosApi } from '@/lib/servicios-api';
import { ApiError } from '@/lib/api';
import { nuevaReservaSchema, type NuevaReservaFormValues } from '@/lib/validation';

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
          title: `${reserva.cliente?.nombreCompleto ?? 'Cliente eliminado'} · ${reserva.servicio?.nombre ?? 'Servicio eliminado'}${cancelada ? ' (cancelada)' : ''}`,
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
    [reservasData],
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
      mostrarToast({ variante: 'exito', titulo: 'Reserva creada' });
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
        titulo: error instanceof ApiError ? error.message : 'No se pudo crear la reserva',
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
        mostrarToast({ variante: 'exito', titulo: 'Reserva reprogramada' });
        queryClient.invalidateQueries({ queryKey: ['reservas'] });
      } catch (error) {
        info.revert();
        const mensaje =
          error instanceof ApiError ? error.message : 'No se pudo reprogramar la reserva';
        mostrarToast({ variante: 'error', titulo: mensaje });
      }
    },
    [mostrarToast, queryClient],
  );

  const confirmarCancelacion = async () => {
    if (!reservaSeleccionada) return;
    try {
      await reservasApi.cancelar(reservaSeleccionada.idReserva);
      mostrarToast({ variante: 'exito', titulo: 'Reserva cancelada' });
      await queryClient.invalidateQueries({ queryKey: ['reservas'] });
      setConfirmandoCancelar(false);
      setReservaSeleccionada(null);
    } catch (error) {
      const mensaje = error instanceof ApiError ? error.message : 'No se pudo cancelar la reserva';
      mostrarToast({ variante: 'error', titulo: mensaje });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Calendario</h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={idUsuarioFiltro}
              onChange={(evento) => setIdUsuarioFiltro(evento.target.value)}
              aria-label="Filtrar por empleado"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">Todos los empleados</option>
              {empleados.map((empleado) => (
                <option key={empleado.idUsuario} value={empleado.idUsuario}>
                  {empleado.nombreCompleto}
                </option>
              ))}
            </select>
            <Boton onClick={() => abrirModalNuevaReserva(new Date(), true)}>Nueva reserva</Boton>
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
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">Actualizando…</p>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={window.innerWidth < PUNTO_QUIEBRE_MOBILE ? 'listWeek' : 'dayGridMonth'}
            headerToolbar={
              window.innerWidth < PUNTO_QUIEBRE_MOBILE ? TOOLBAR_MOBILE : TOOLBAR_DESKTOP
            }
            locale={esLocale}
            height="auto"
            editable
            eventStartEditable
            eventDurationEditable={false}
            businessHours={businessHours.length > 0 ? businessHours : undefined}
            events={eventos}
            // Con varias reservas el mismo día, el mes ya no las apila todas
            // (se veían con el texto cortado a la mitad) — se limita a 3 y
            // el resto queda detrás de un enlace "+N más" nativo de
            // FullCalendar, que al abrirse muestra cada evento completo.
            dayMaxEvents={3}
            eventDidMount={(info) => {
              // Tooltip nativo del navegador con el título completo — red
              // de seguridad adicional para cuando el texto sí se corta
              // visualmente en la celda (nombres largos, mes muy angosto).
              info.el.title = info.event.title;
            }}
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
        titulo="Detalle de la reserva"
      >
        {reservaSeleccionada && (
          <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-medium">Cliente:</span>{' '}
              {reservaSeleccionada.cliente?.nombreCompleto ?? 'Cliente eliminado'}
            </p>
            <p>
              <span className="font-medium">Servicio:</span>{' '}
              {reservaSeleccionada.servicio?.nombre ?? 'Servicio eliminado'}
            </p>
            <p>
              <span className="font-medium">Atiende:</span>{' '}
              {reservaSeleccionada.usuario?.nombreCompleto ?? 'Usuario eliminado'}
            </p>
            <p>
              <span className="font-medium">Horario:</span>{' '}
              {new Date(reservaSeleccionada.fechaHoraInicio).toLocaleString('es-CR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <p>
              <span className="font-medium">Estado:</span> {reservaSeleccionada.estado}
            </p>
            {reservaSeleccionada.estado !== 'cancelada' && (
              <Boton
                variante="destructivo"
                className="mt-4"
                onClick={() => setConfirmandoCancelar(true)}
              >
                Cancelar reserva
              </Boton>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={confirmandoCancelar}
        titulo="¿Cancelar esta reserva?"
        descripcion="Esta acción no se puede deshacer."
        onConfirmar={confirmarCancelacion}
        onCancelar={() => setConfirmandoCancelar(false)}
      />

      <Modal
        abierto={modalNuevaReservaAbierto}
        onCerrar={() => setModalNuevaReservaAbierto(false)}
        titulo="Nueva reserva"
      >
        <form
          onSubmit={handleSubmitNuevaReserva((valores) => crearReservaMutation.mutate(valores))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Select
            label="Cliente"
            variante="crear"
            requerido
            placeholder="Selecciona un cliente"
            opciones={clientesActivos.map((c) => ({ value: c.idCliente, label: c.nombreCompleto }))}
            error={erroresNuevaReserva.idCliente?.message}
            {...registerNuevaReserva('idCliente')}
          />
          <Select
            label="Servicio"
            variante="crear"
            requerido
            placeholder="Selecciona un servicio"
            opciones={serviciosActivos.map((s) => ({ value: s.idServicio, label: s.nombre }))}
            error={erroresNuevaReserva.idServicio?.message}
            {...registerNuevaReserva('idServicio')}
          />
          <Select
            label="Atiende"
            variante="crear"
            requerido
            placeholder="Selecciona quién atiende"
            opciones={empleadosActivos.map((e) => ({
              value: e.idUsuario,
              label: e.nombreCompleto,
            }))}
            error={erroresNuevaReserva.idUsuario?.message}
            {...registerNuevaReserva('idUsuario')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Fecha"
              type="date"
              variante="crear"
              requerido
              error={erroresNuevaReserva.fecha?.message}
              {...registerNuevaReserva('fecha')}
            />
            <Input
              label="Hora"
              type="time"
              variante="crear"
              requerido
              error={erroresNuevaReserva.hora?.message}
              {...registerNuevaReserva('hora')}
            />
          </div>
          <Input
            label="Notas"
            variante="crear"
            hint="Opcional"
            error={erroresNuevaReserva.notas?.message}
            {...registerNuevaReserva('notas')}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Boton
              variante="secundario"
              type="button"
              onClick={() => setModalNuevaReservaAbierto(false)}
            >
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enviandoNuevaReserva || crearReservaMutation.isPending}>
              Crear reserva
            </Boton>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
