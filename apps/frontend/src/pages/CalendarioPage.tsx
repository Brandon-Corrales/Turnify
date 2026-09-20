import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Boton, ConfirmDialog, Modal, useToast } from '@/components/ui';
import { reservasApi, type Reserva } from '@/lib/reservas-api';
import { disponibilidadApi } from '@/lib/disponibilidad-api';
import { usuariosApi } from '@/lib/usuarios-api';
import { ApiError } from '@/lib/api';

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
 * Alcance de esta tarjeta: mostrar reservas + disponibilidad, cancelar y
 * reprogramar (arrastrar un evento). Crear una reserva nueva desde el
 * calendario es del wizard de reserva (tarjeta de frontend de después del
 * Seguimiento #2) — no se adelanta aquí.
 */
export default function CalendarioPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [rango, setRango] = useState<RangoVisible | null>(null);
  const [idUsuarioFiltro, setIdUsuarioFiltro] = useState('');
  const [reservaSeleccionada, setReservaSeleccionada] = useState<Reserva | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
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
  const empleados = usuariosData?.data ?? [];

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
          title: `${reserva.servicio?.nombre ?? 'Servicio eliminado'} · ${reserva.cliente?.nombreCompleto ?? 'Cliente eliminado'}${cancelada ? ' (cancelada)' : ''}`,
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
            datesSet={alCambiarRangoVisible}
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
    </AppLayout>
  );
}
