import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Boton } from '@/components/ui';
import { SkeletonText } from '@/components/ui/Skeleton';
import { suscripcionesApi } from '@/lib/suscripciones-api';

const CARACTERISTICAS = [
  {
    icono: Calendar,
    titulo: 'Calendario en tiempo real',
    descripcion:
      'Reservas y disponibilidad de tu equipo en un calendario visual, sin choques de horario.',
  },
  {
    icono: Bell,
    titulo: 'Notificaciones automáticas',
    descripcion: 'Confirmaciones y recordatorios por correo (y WhatsApp en el plan de pago).',
  },
  {
    icono: BarChart3,
    titulo: 'Reportes reales',
    descripcion: 'Reservas por período e ingresos estimados, calculados desde tus datos.',
  },
  {
    icono: MessageCircle,
    titulo: 'Asistente con IA',
    descripcion: 'Un chatbot contextual responde dudas sobre tu propio negocio, en tiempo real.',
  },
  {
    icono: Building2,
    titulo: 'Para cualquier vertical',
    descripcion: 'Barberías, clínicas, spas, academias — plantillas de servicios por rubro.',
  },
  {
    icono: ShieldCheck,
    titulo: 'Multi-negocio seguro',
    descripcion: 'Cada negocio ve solo sus propios datos — aislamiento real, no solo de nombre.',
  },
];

const VARIANTES_SECCION = {
  oculto: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function Seccion({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={VARIANTES_SECCION}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function ItemPlan({ incluido, texto }: { incluido: boolean; texto: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {incluido ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-600 dark:text-secondary-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
      )}
      <span
        className={
          incluido ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'
        }
      >
        {texto}
      </span>
    </li>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const {
    data: planes,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['suscripciones', 'planes'],
    queryFn: suscripcionesApi.obtenerPlanes,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
            Turnify
          </span>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              Iniciar sesión
            </Link>
            <Boton tamano="sm" onClick={() => navigate('/registro')}>
              Registrar mi negocio
            </Boton>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Reservas y turnos, sin hojas de cálculo
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Gestiona las reservas de tu negocio en un solo lugar
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Calendario, clientes, notificaciones y reportes para barberías, clínicas, spas y
              academias — empieza gratis, sin tarjeta de crédito.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Boton tamano="lg" onClick={() => navigate('/registro')}>
                Crear cuenta gratis
              </Boton>
              <Boton variante="secundario" tamano="lg" onClick={() => navigate('/login')}>
                Ya tengo cuenta
              </Boton>
            </div>
          </motion.div>
        </section>

        {/* Características */}
        <Seccion className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
            Todo lo que tu negocio necesita
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CARACTERISTICAS.map(({ icono: Icono, titulo, descripcion }, i) => (
              <motion.div
                key={titulo}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="rounded-xl border border-slate-200 p-6 dark:border-slate-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-medium text-slate-900 dark:text-white">{titulo}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{descripcion}</p>
              </motion.div>
            ))}
          </div>
        </Seccion>

        {/* Planes */}
        <Seccion className="bg-slate-50 py-16 dark:bg-slate-800/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
              Un plan para cada etapa de tu negocio
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Empieza gratis. Los límites de abajo son los mismos que aplica el sistema — no una
              tabla aparte.
            </p>

            {isError && (
              <p className="mt-8 text-center text-sm text-danger">
                No se pudieron cargar los límites del plan en este momento.
              </p>
            )}

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Plan Gratis */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Plan Gratis
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Para empezar a probar Turnify
                </p>
                <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">₡0</p>

                {isPending ? (
                  <SkeletonText lineas={6} className="mt-6" />
                ) : (
                  <ul className="mt-6 flex flex-col gap-2.5">
                    <ItemPlan
                      incluido
                      texto={`Hasta ${planes?.gratis.usuarios ?? 1} usuario (admin)`}
                    />
                    <ItemPlan
                      incluido
                      texto={`Hasta ${planes?.gratis.servicios ?? 3} servicios activos`}
                    />
                    <ItemPlan
                      incluido
                      texto={`Hasta ${planes?.gratis.reservasPorMes ?? 20} reservas por mes`}
                    />
                    <ItemPlan
                      incluido
                      texto={`Hasta ${planes?.gratis.mensajesChatbotPorDia ?? 10} mensajes al chatbot/día`}
                    />
                    <ItemPlan incluido texto="Notificaciones por correo electrónico" />
                    <ItemPlan incluido={false} texto="Notificaciones por WhatsApp" />
                    <ItemPlan incluido={false} texto="Personalización de marca" />
                  </ul>
                )}

                <Boton
                  variante="secundario"
                  className="mt-6 w-full"
                  onClick={() => navigate('/registro')}
                >
                  Empezar gratis
                </Boton>
              </div>

              {/* Plan de Pago */}
              <div className="relative rounded-xl border-2 border-primary-600 bg-white p-6 dark:bg-slate-900">
                <span className="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-medium text-white">
                  Sin límites
                </span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Plan de Pago
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Para negocios en crecimiento
                </p>
                <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
                  Cobro mensual
                </p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  <ItemPlan incluido texto="Usuarios y empleados ilimitados" />
                  <ItemPlan incluido texto="Servicios ilimitados" />
                  <ItemPlan incluido texto="Reservas ilimitadas" />
                  <ItemPlan incluido texto="Mensajes al chatbot sin límite diario" />
                  <ItemPlan incluido texto="Notificaciones por correo y WhatsApp" />
                  <ItemPlan incluido texto="Personalización de marca" />
                </ul>

                <Boton className="mt-6 w-full" onClick={() => navigate('/registro')}>
                  Empezar y actualizar luego
                </Boton>
              </div>
            </div>
          </div>
        </Seccion>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
        Turnify — proyecto académico EIF409, UNA Costa Rica.
      </footer>
    </div>
  );
}
