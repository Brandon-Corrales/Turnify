import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Calendar,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Banner, Boton } from '@/components/ui';
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { disponibilidadApi } from '@/lib/disponibilidad-api';
import {
  diasDelMesEnZonaNegocio,
  hoyEnZonaNegocio,
  mesYAnioEnZonaNegocio,
  rangoMesEnZonaNegocio,
  ZONA_HORARIA_NEGOCIO,
} from '@/lib/fecha-negocio';
import { negociosApi } from '@/lib/negocios-api';
import { reportesApi, type ResumenReportes } from '@/lib/reportes-api';
import {
  crearEtiquetaEstadoReserva,
  ESTILO_ESTADO_RESERVA,
  reservasApi,
  type Reserva,
} from '@/lib/reservas-api';

/** Todas las reservas del rango, recorriendo las páginas (el backend devuelve como máximo 100 por página). */
async function listarTodasLasReservas(desde: string, hasta: string): Promise<Reserva[]> {
  const reservas: Reserva[] = [];
  for (let page = 1; ; page++) {
    const pagina = await reservasApi.listar({ desde, hasta, page });
    reservas.push(...pagina.data);
    if (reservas.length >= pagina.total || pagina.data.length === 0) return reservas;
  }
}

function formatearColones(monto: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(monto);
}

function totalReservas(porEstado: ResumenReportes['reservasPorEstado']): number {
  return Object.values(porEstado).reduce((suma, cantidad) => suma + cantidad, 0);
}

interface TarjetaKpiProps {
  icono: typeof Calendar;
  etiqueta: string;
  valor: string;
  claseIcono: string;
}

function TarjetaKpi({ icono: Icono, etiqueta, valor, claseIcono }: TarjetaKpiProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${claseIcono}`}>
        <Icono className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{valor}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{etiqueta}</p>
    </div>
  );
}

function localeDe(idioma: string): string {
  return idioma.startsWith('en') ? 'en-US' : 'es-CR';
}

/** `fecha` es un día `YYYY-MM-DD` de la zona del negocio: se formatea como medianoche UTC con timeZone 'UTC' para que el navegador no lo corra un día. */
function formatearDia(fecha: string, idioma: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Date(`${fecha}T00:00:00.000Z`).toLocaleDateString(localeDe(idioma), {
    ...opciones,
    timeZone: 'UTC',
  });
}

function formatearHora(iso: string, idioma: string): string {
  return new Date(iso).toLocaleTimeString(localeDe(idioma), {
    timeZone: ZONA_HORARIA_NEGOCIO,
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface GraficoReservasPorDiaProps {
  dias: string[];
  conteoPorDia: Map<string, number>;
  hoy: string;
  seleccionado: string;
  onSeleccionar: (fecha: string) => void;
}

/**
 * Una barra por cada día del mes (también los que no tienen citas, para que
 * cada barra caiga sobre su número de día). Cada barra es un botón que
 * selecciona el día y muestra sus citas debajo. Teclado: un solo tab stop
 * (el día seleccionado) y flechas/Inicio/Fin para moverse, como un grupo de
 * radios. Sin librería de gráficos: esa queda para la pantalla de Reportes.
 */
function GraficoReservasPorDia({
  dias,
  conteoPorDia,
  hoy,
  seleccionado,
  onSeleccionar,
}: GraficoReservasPorDiaProps) {
  const { t, i18n } = useTranslation();
  const botones = useRef<Array<HTMLButtonElement | null>>([]);
  const maximo = Math.max(1, ...conteoPorDia.values());
  const diaSeleccionado = Number(seleccionado.slice(8));
  const diaHoy = Number(hoy.slice(8));
  const pegadoA = (a: number, b: number) => Math.abs(a - b) === 1;
  // En pantallas angostas solo caben algunos números: el 1, cada 5, hoy y el
  // elegido. Un número pegado al elegido (o a hoy) se oculta para que no se
  // lean juntos ("20" y "21" como "2021"); hoy conserva su punto debajo.
  const visibleEnMovil = (numeroDia: number, activo: boolean, esHoy: boolean) =>
    activo ||
    (esHoy && !pegadoA(numeroDia, diaSeleccionado)) ||
    ((numeroDia === 1 || numeroDia % 5 === 0) &&
      !pegadoA(numeroDia, diaSeleccionado) &&
      !pegadoA(numeroDia, diaHoy));

  const moverA = (indice: number) => {
    const destino = Math.min(dias.length - 1, Math.max(0, indice));
    onSeleccionar(dias[destino]);
    botones.current[destino]?.focus();
  };

  const alPresionarTecla = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const destinos: Record<string, number> = {
      ArrowLeft: indice - 1,
      ArrowRight: indice + 1,
      Home: 0,
      End: dias.length - 1,
    };
    if (evento.key in destinos) {
      evento.preventDefault();
      moverA(destinos[evento.key]);
    }
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        role="radiogroup"
        aria-label={t('dashboard.graficoAriaLabel')}
        className="flex min-w-[18rem] items-stretch gap-0.5 sm:gap-1"
      >
        {dias.map((fecha, i) => {
          const cantidad = conteoPorDia.get(fecha) ?? 0;
          const activo = fecha === seleccionado;
          const esHoy = fecha === hoy;
          const numeroDia = Number(fecha.slice(8));
          return (
            <button
              key={fecha}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={activo}
              tabIndex={activo ? 0 : -1}
              aria-label={t('dashboard.barraDiaAriaLabel', {
                fecha: formatearDia(fecha, i18n.language, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }),
                count: cantidad,
              })}
              onClick={() => onSeleccionar(fecha)}
              onKeyDown={(e) => alPresionarTecla(e, i)}
              className={`group flex min-w-0 flex-1 flex-col items-center rounded-md pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                activo
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
              }`}
            >
              <span
                className={`h-4 text-[10px] leading-4 tabular-nums ${
                  activo
                    ? 'font-semibold text-primary-700 dark:text-primary-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                aria-hidden="true"
              >
                {cantidad > 0 ? cantidad : ''}
              </span>
              <span className="flex h-28 w-full items-end justify-center" aria-hidden="true">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{
                    height: cantidad > 0 ? `${Math.max(6, (cantidad / maximo) * 100)}%` : '3px',
                  }}
                  transition={{ duration: 0.4, delay: i * 0.01 }}
                  className={`block w-full max-w-5 rounded-t ${
                    cantidad === 0
                      ? 'bg-slate-200 dark:bg-slate-700'
                      : activo
                        ? 'bg-primary-600 dark:bg-primary-400'
                        : 'bg-primary-300 group-hover:bg-primary-400 dark:bg-primary-700 dark:group-hover:bg-primary-600'
                  }`}
                />
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 h-5 text-[10px] leading-5 tabular-nums sm:text-xs ${
                  visibleEnMovil(numeroDia, activo, esHoy) ? '' : 'invisible sm:visible'
                } ${
                  activo
                    ? 'font-semibold text-primary-700 dark:text-primary-300'
                    : esHoy
                      ? 'font-semibold text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {numeroDia}
              </span>
              <span
                aria-hidden="true"
                className={`mb-1 h-1 w-1 rounded-full ${esHoy ? 'bg-primary-500' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CitasDelDiaProps {
  fecha: string;
  citas: Reserva[];
  estado: 'pending' | 'error' | 'success';
  esPrimerDia: boolean;
  esUltimoDia: boolean;
  onCambiarDia: (desplazamiento: -1 | 1) => void;
}

/** Lista de las citas del día elegido en la gráfica (ya agrupadas por día en InicioPage). */
function CitasDelDia({
  fecha,
  citas,
  estado,
  esPrimerDia,
  esUltimoDia,
  onCambiarDia,
}: CitasDelDiaProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const etiquetaEstado = crearEtiquetaEstadoReserva(t);
  const titulo = formatearDia(fecha, i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section
      aria-labelledby="citas-del-dia-titulo"
      className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="citas-del-dia-titulo"
            className="text-sm font-medium text-slate-900 dark:text-white"
          >
            {t('dashboard.citasDelDia', { fecha: titulo })}
          </h2>
          {estado === 'success' && (
            <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              {t('dashboard.cantidadCitas', { count: citas.length })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Boton
            variante="icono"
            onClick={() => onCambiarDia(-1)}
            disabled={esPrimerDia}
            aria-label={t('dashboard.diaAnterior')}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Boton>
          <Boton
            variante="icono"
            onClick={() => onCambiarDia(1)}
            disabled={esUltimoDia}
            aria-label={t('dashboard.diaSiguiente')}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => navigate('/calendario')}>
            {t('dashboard.verCalendario')}
          </Boton>
        </div>
      </div>

      {estado === 'pending' && <SkeletonText lineas={3} className="mt-4" />}

      {estado === 'error' && (
        <p className="mt-4 text-sm text-danger">{t('dashboard.errorCitasDelDia')}</p>
      )}

      {estado === 'success' && citas.length === 0 && (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
          {t('dashboard.sinCitasEsteDia')}
        </p>
      )}

      {citas.length > 0 && (
        <motion.ul
          key={fecha}
          initial="oculto"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          className="mt-4 divide-y divide-slate-100 dark:divide-slate-700"
        >
          {citas.map((cita) => {
            const cancelada = cita.estado === 'cancelada';
            return (
              <motion.li
                key={cita.idReserva}
                variants={{ oculto: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <span
                  className={`w-full shrink-0 whitespace-nowrap text-sm font-medium tabular-nums sm:w-44 text-slate-900 dark:text-white ${
                    cancelada ? 'line-through opacity-60' : ''
                  }`}
                >
                  {formatearHora(cita.fechaHoraInicio, i18n.language)} –{' '}
                  {formatearHora(cita.fechaHoraFin, i18n.language)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-900 dark:text-white">
                    {cita.cliente.nombreCompleto}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cita.servicio.colorCalendario ?? '#94a3b8' }}
                      aria-hidden="true"
                    />
                    {cita.servicio.nombre} · {cita.usuario.nombreCompleto}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO_RESERVA[cita.estado]}`}
                >
                  {etiquetaEstado[cita.estado]}
                </span>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}

export default function InicioPage() {
  const { t, i18n } = useTranslation();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { desde, hasta } = rangoMesEnZonaNegocio();
  const hoy = hoyEnZonaNegocio();
  const diasDelMes = diasDelMesEnZonaNegocio();
  const [diaElegido, setDiaSeleccionado] = useState(hoy);
  // Si la pestaña queda abierta de un mes al siguiente, el día elegido ya no
  // está en la gráfica: se vuelve a hoy.
  const diaSeleccionado = diasDelMes.includes(diaElegido) ? diaElegido : hoy;

  const negocioQuery = useQuery({
    queryKey: ['negocios', 'mi-negocio'],
    queryFn: negociosApi.obtenerMiNegocio,
  });

  // Misma query (y misma caché) que el Calendario. Sin ninguna franja
  // activa, ni el link público ni el Calendario pueden ofrecer horarios,
  // y un negocio recién registrado arranca así.
  const disponibilidadQuery = useQuery({
    queryKey: ['disponibilidad'],
    queryFn: () => disponibilidadApi.listar(),
  });
  const sinHorarioLaboral =
    disponibilidadQuery.isSuccess && !disponibilidadQuery.data.some((franja) => franja.activo);

  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen', desde, hasta],
    queryFn: () => reportesApi.obtenerResumen({ desde, hasta }),
  });

  // El backend trabaja solo en UTC: `reservasPorDia` del resumen agrupa por
  // día UTC, que no es el día que ve el negocio (una cita a las 18:00 hora
  // CR ya es el día siguiente en UTC). Por eso la gráfica y la lista se
  // arman aquí, en la capa de presentación, con las reservas del mes tal
  // como las devuelve la API y convirtiendo cada inicio a hora CR.
  const reservasMesQuery = useQuery({
    queryKey: ['reservas', 'dashboard-mes', desde, hasta],
    queryFn: () => listarTodasLasReservas(desde, hasta),
  });

  const esPlanGratis = negocioQuery.data?.planSuscripcion === 'gratis';
  const resumen = resumenQuery.data;
  const total = resumen ? totalReservas(resumen.reservasPorEstado) : 0;
  const nombreMes = mesYAnioEnZonaNegocio(i18n.language);
  const citasPorDia = useMemo(() => {
    const porDia = new Map<string, Reserva[]>();
    for (const reserva of reservasMesQuery.data ?? []) {
      const dia = hoyEnZonaNegocio(new Date(reserva.fechaHoraInicio));
      porDia.set(dia, [...(porDia.get(dia) ?? []), reserva]);
    }
    return porDia;
  }, [reservasMesQuery.data]);
  const conteoPorDia = useMemo(
    () => new Map([...citasPorDia].map(([dia, citas]) => [dia, citas.length])),
    [citasPorDia],
  );
  const indiceSeleccionado = diasDelMes.indexOf(diaSeleccionado);
  const cambiarDia = (desplazamiento: -1 | 1) => {
    const destino = diasDelMes[indiceSeleccionado + desplazamiento];
    if (destino) setDiaSeleccionado(destino);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t('dashboard.hola', { nombre: usuario?.nombreCompleto?.split(' ')[0] })}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.resumenDe', { mes: nombreMes })}
            </p>
          </div>
          {negocioQuery.isPending ? (
            <Skeleton className="h-7 w-24 rounded-full" />
          ) : (
            <span
              className={
                esPlanGratis
                  ? 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  : 'rounded-full bg-secondary-100 px-3 py-1 text-xs font-medium text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-300'
              }
            >
              {esPlanGratis ? t('dashboard.planGratis') : t('dashboard.planPago')}
            </span>
          )}
        </div>

        {sinHorarioLaboral && (
          <Banner
            className="mt-6"
            variante="advertencia"
            titulo={t('dashboard.bannerSinHorarioTitulo')}
            descripcion={t('dashboard.bannerSinHorarioDescripcion')}
            accion={
              <Boton tamano="sm" onClick={() => navigate('/configuracion')}>
                {t('dashboard.bannerSinHorarioBoton')}
              </Boton>
            }
          />
        )}

        {esPlanGratis && (
          <Banner
            className="mt-6"
            variante="info"
            titulo={t('dashboard.bannerPlanGratisTitulo')}
            descripcion={t('dashboard.bannerPlanGratisDescripcion')}
            accion={
              <Boton tamano="sm" onClick={() => navigate('/suscripcion')}>
                {t('dashboard.bannerPlanGratisBoton')}
              </Boton>
            }
          />
        )}

        {resumenQuery.isPending && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {resumenQuery.isError && (
          <p className="mt-6 text-sm text-danger">{t('dashboard.errorResumen')}</p>
        )}

        {resumen && (
          <>
            <motion.div
              initial="oculto"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                {
                  icono: Calendar,
                  etiqueta: t('dashboard.reservasEsteMes'),
                  valor: String(total),
                  claseIcono:
                    'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400',
                },
                {
                  icono: CheckCircle2,
                  etiqueta: t('dashboard.confirmadas'),
                  valor: String(resumen.reservasPorEstado.confirmada),
                  claseIcono:
                    'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/40 dark:text-secondary-400',
                },
                {
                  icono: CalendarX2,
                  etiqueta: t('dashboard.canceladas'),
                  valor: String(resumen.reservasPorEstado.cancelada),
                  claseIcono: 'bg-red-50 text-danger dark:bg-red-900/30',
                },
                {
                  icono: Coins,
                  etiqueta: t('dashboard.ingresosEstimados'),
                  valor: formatearColones(resumen.ingresosEstimados),
                  claseIcono: 'bg-amber-50 text-warning dark:bg-amber-900/30',
                },
              ].map((tarjeta) => (
                <motion.div
                  key={tarjeta.etiqueta}
                  variants={{ oculto: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                >
                  <TarjetaKpi {...tarjeta} />
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <TrendingUp
                  className="h-4 w-4 text-primary-600 dark:text-primary-400"
                  aria-hidden="true"
                />
                {t('dashboard.reservasPorDia')}
              </div>
              {total === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
                  <Calendar
                    className="h-8 w-8 text-slate-300 dark:text-slate-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('dashboard.sinReservas')}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/calendario')}
                    className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    {t('dashboard.verCalendario')}
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('dashboard.graficoAyuda')}
                  </p>
                  <div className="mt-4">
                    <GraficoReservasPorDia
                      dias={diasDelMes}
                      conteoPorDia={conteoPorDia}
                      hoy={hoy}
                      seleccionado={diaSeleccionado}
                      onSeleccionar={setDiaSeleccionado}
                    />
                  </div>
                  <CitasDelDia
                    fecha={diaSeleccionado}
                    citas={citasPorDia.get(diaSeleccionado) ?? []}
                    estado={reservasMesQuery.status}
                    esPrimerDia={indiceSeleccionado <= 0}
                    esUltimoDia={indiceSeleccionado >= diasDelMes.length - 1}
                    onCambiarDia={cambiarDia}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
