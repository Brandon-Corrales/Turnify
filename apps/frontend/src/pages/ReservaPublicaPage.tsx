import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CalendarCheck, CalendarClock, Check, ClipboardList, User } from 'lucide-react';
import { Banner, Boton, Input } from '@/components/ui';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api';
import { reservaPublicaApi, type ServicioPublico } from '@/lib/reserva-publica-api';
import {
  crearDatosClientePublicoSchema,
  type DatosClientePublicoFormValues,
} from '@/lib/validation';

function hoyYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatearHoraCR(iso: string, idioma: string): string {
  return new Date(iso).toLocaleTimeString(idioma.startsWith('en') ? 'en-US' : 'es-CR', {
    timeZone: 'America/Costa_Rica',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatearFechaCR(iso: string, idioma: string): string {
  return new Date(iso).toLocaleDateString(idioma.startsWith('en') ? 'en-US' : 'es-CR', {
    timeZone: 'America/Costa_Rica',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatearColones(monto: number, idioma: string): string {
  return `₡${monto.toLocaleString(idioma.startsWith('en') ? 'en-US' : 'es-CR')}`;
}

function Indicador({
  pasoActual,
  pasos,
}: {
  pasoActual: number;
  pasos: readonly { numero: number; etiqueta: string; icono: typeof ClipboardList }[];
}) {
  return (
    <ol className="mx-auto flex max-w-xl items-center justify-between gap-1 sm:gap-2">
      {pasos.map(({ numero, etiqueta, icono: Icono }, i) => (
        <li key={numero} className="flex flex-1 items-center gap-1 sm:gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                numero < pasoActual
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : numero === pasoActual
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-600'
              }`}
            >
              {numero < pasoActual ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icono className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <span className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
              {etiqueta}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div
              className={`h-0.5 flex-1 rounded ${
                numero < pasoActual ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export default function ReservaPublicaPage() {
  const { t, i18n } = useTranslation();
  const { idNegocio = '' } = useParams<{ idNegocio: string }>();
  const [paso, setPaso] = useState(1);
  const [servicio, setServicio] = useState<ServicioPublico | null>(null);
  const [fecha, setFecha] = useState(hoyYYYYMMDD());
  const [horario, setHorario] = useState<string | null>(null);
  const [datosCliente, setDatosCliente] = useState<DatosClientePublicoFormValues | null>(null);

  const pasos = useMemo(
    () =>
      [
        { numero: 1, etiqueta: t('reservaPublica.pasoServicio'), icono: ClipboardList },
        { numero: 2, etiqueta: t('reservaPublica.pasoHorario'), icono: CalendarClock },
        { numero: 3, etiqueta: t('reservaPublica.pasoTusDatos'), icono: User },
        { numero: 4, etiqueta: t('reservaPublica.pasoConfirmacion'), icono: CalendarCheck },
      ] as const,
    [t],
  );

  const negocioQuery = useQuery({
    queryKey: ['reserva-publica', 'negocio', idNegocio],
    queryFn: () => reservaPublicaApi.obtenerNegocio(idNegocio),
  });

  const serviciosQuery = useQuery({
    queryKey: ['reserva-publica', 'servicios', idNegocio],
    queryFn: () => reservaPublicaApi.listarServicios(idNegocio),
    enabled: paso === 1,
  });

  const horariosQuery = useQuery({
    queryKey: ['reserva-publica', 'horarios', idNegocio, servicio?.idServicio, fecha],
    queryFn: () => reservaPublicaApi.listarHorarios(idNegocio, servicio!.idServicio, fecha),
    enabled: paso === 2 && !!servicio,
  });

  const datosClientePublicoSchema = useMemo(() => crearDatosClientePublicoSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosClientePublicoFormValues>({ resolver: zodResolver(datosClientePublicoSchema) });

  const confirmarMutation = useMutation({
    mutationFn: () =>
      reservaPublicaApi.crearReserva(idNegocio, {
        idServicio: servicio!.idServicio,
        fechaHoraInicio: horario!,
        cliente: datosCliente!,
      }),
  });

  const mensajeErrorConfirmacion = useMemo(() => {
    const error = confirmarMutation.error;
    if (!error) return null;
    return error instanceof ApiError ? error.message : t('reservaPublica.errorConfirmarGenerico');
  }, [confirmarMutation.error, t]);

  if (negocioQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
        <Banner
          variante="error"
          titulo={t('reservaPublica.negocioNoEncontradoTitulo')}
          descripcion={t('reservaPublica.negocioNoEncontradoDescripcion')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400">
            {t('comun.turnify')}
          </p>
          {negocioQuery.isPending ? (
            <Skeleton className="mt-1 h-6 w-48" />
          ) : (
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('reservaPublica.reservarEn', { nombre: negocioQuery.data?.nombre })}
            </h1>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <Indicador pasoActual={paso} pasos={pasos} />

        <div className="relative mt-8 min-h-[320px]">
          <>
            {paso === 1 && (
              <motion.div
                key="paso-1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-lg font-medium text-slate-900 dark:text-white">
                  {t('reservaPublica.queServicioTitulo')}
                </h2>
                <div className="mt-4 flex flex-col gap-3">
                  {serviciosQuery.isPending &&
                    Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                  {serviciosQuery.isError && (
                    <Banner
                      variante="error"
                      titulo={t('reservaPublica.errorServiciosTitulo')}
                      descripcion={t('reservaPublica.errorServiciosDescripcion')}
                    />
                  )}
                  {serviciosQuery.data?.length === 0 && (
                    <Banner variante="info" titulo={t('reservaPublica.sinServiciosTitulo')} />
                  )}
                  {serviciosQuery.data?.map((s) => (
                    <button
                      key={s.idServicio}
                      type="button"
                      onClick={() => {
                        setServicio(s);
                        setHorario(null);
                        setPaso(2);
                      }}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-500 dark:hover:bg-primary-900/10"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{s.nombre}</p>
                        {s.descripcion && (
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            {s.descripcion}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          {t('comun.minutosAbreviatura', { n: s.duracionMinutos })}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                        {formatearColones(Number(s.precio), i18n.language)}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {paso === 2 && servicio && (
              <motion.div
                key="paso-2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-lg font-medium text-slate-900 dark:text-white">
                  {t('reservaPublica.eligeHorarioTitulo', { servicio: servicio.nombre })}
                </h2>
                <Input
                  type="date"
                  label={t('calendario.campoFecha')}
                  className="mt-4 max-w-xs"
                  min={hoyYYYYMMDD()}
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setHorario(null);
                  }}
                />

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {horariosQuery.isPending &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  {horariosQuery.data?.length === 0 && (
                    <p className="col-span-full text-sm text-slate-500 dark:text-slate-400">
                      {t('reservaPublica.sinHorarios')}
                    </p>
                  )}
                  {horariosQuery.data?.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorario(h)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        horario === h
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-primary-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {formatearHoraCR(h, i18n.language)}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex justify-between">
                  <Boton variante="secundario" onClick={() => setPaso(1)}>
                    {t('reservaPublica.atras')}
                  </Boton>
                  <Boton disabled={!horario} onClick={() => setPaso(3)}>
                    {t('comun.siguiente')}
                  </Boton>
                </div>
              </motion.div>
            )}

            {paso === 3 && (
              <motion.form
                key="paso-3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSubmit((valores) => {
                  setDatosCliente(valores);
                  setPaso(4);
                })}
                noValidate
              >
                <h2 className="text-lg font-medium text-slate-900 dark:text-white">
                  {t('reservaPublica.pasoTusDatos')}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  <Input
                    label={t('clientes.nombreCompleto')}
                    requerido
                    error={errors.nombreCompleto?.message}
                    {...register('nombreCompleto')}
                  />
                  <Input
                    label={t('comun.correoElectronico')}
                    type="email"
                    requerido
                    error={errors.correoElectronico?.message}
                    {...register('correoElectronico')}
                  />
                  <Input
                    label={t('clientes.telefono')}
                    type="tel"
                    error={errors.telefono?.message}
                    {...register('telefono')}
                  />
                </div>
                <div className="mt-6 flex justify-between">
                  <Boton type="button" variante="secundario" onClick={() => setPaso(2)}>
                    {t('reservaPublica.atras')}
                  </Boton>
                  <Boton type="submit">{t('comun.siguiente')}</Boton>
                </div>
              </motion.form>
            )}

            {paso === 4 && servicio && horario && datosCliente && (
              <motion.div
                key="paso-4"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                {confirmarMutation.isSuccess ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-100 text-secondary-600 dark:bg-secondary-900/40 dark:text-secondary-400"
                    >
                      <Check className="h-8 w-8" aria-hidden="true" />
                    </motion.div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                      {t('reservaPublica.confirmadaTitulo')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {servicio.nombre} · {formatearFechaCR(horario, i18n.language)} ·{' '}
                      {formatearHoraCR(horario, i18n.language)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {t('reservaPublica.confirmacionEnviada', {
                        correo: datosCliente.correoElectronico,
                      })}
                    </p>
                    <Link
                      to="/"
                      className="mt-6 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                    >
                      {t('reservaPublica.volverAlInicio')}
                    </Link>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-medium text-slate-900 dark:text-white">
                      {t('reservaPublica.confirmaTuReserva')}
                    </h2>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                      <dl className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            {t('reservaPublica.servicio')}
                          </dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {servicio.nombre}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            {t('reservaPublica.cuando')}
                          </dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {formatearFechaCR(horario, i18n.language)},{' '}
                            {formatearHoraCR(horario, i18n.language)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            {t('reservaPublica.precio')}
                          </dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {formatearColones(Number(servicio.precio), i18n.language)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            {t('clientes.columnaNombre')}
                          </dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {datosCliente.nombreCompleto}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            {t('clientes.columnaCorreo')}
                          </dt>
                          <dd className="font-medium text-slate-900 dark:text-white">
                            {datosCliente.correoElectronico}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {mensajeErrorConfirmacion && (
                      <Banner
                        className="mt-4"
                        variante="error"
                        titulo={t('reservaPublica.errorConfirmarTitulo')}
                        descripcion={mensajeErrorConfirmacion}
                      />
                    )}

                    <div className="mt-6 flex justify-between">
                      <Boton
                        variante="secundario"
                        onClick={() => setPaso(3)}
                        disabled={confirmarMutation.isPending}
                      >
                        {t('reservaPublica.atras')}
                      </Boton>
                      <Boton
                        cargando={confirmarMutation.isPending}
                        onClick={() => confirmarMutation.mutate()}
                      >
                        {t('reservaPublica.confirmarReserva')}
                      </Boton>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </>
        </div>
      </div>
    </div>
  );
}
