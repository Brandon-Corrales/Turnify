import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Boton } from '@/components/ui';
import { ControlesGlobales } from '@/components/layout/ControlesGlobales';
import { TarjetasPlanes } from '@/components/suscripciones/TarjetasPlanes';

const ICONOS_CARACTERISTICAS = [Calendar, Bell, BarChart3, MessageCircle, Building2, ShieldCheck];

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

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const caracteristicas = [1, 2, 3, 4, 5, 6].map((n, i) => ({
    icono: ICONOS_CARACTERISTICAS[i],
    titulo: t(`landing.caract${n}Titulo`),
    descripcion: t(`landing.caract${n}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <span className="shrink-0 text-lg font-semibold text-primary-600 dark:text-primary-400">
            {t('comun.turnify')}
          </span>
          {/* Botón/enlace con texto abreviado en mobile (punto 12: nunca scroll horizontal) — el mismo par gap-3/ControlesGlobales+CTA no cabe en 390px con el texto completo. */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ControlesGlobales />
            <Link
              to="/login"
              className="rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:text-primary-600 sm:px-3 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.iniciarSesion')}
            </Link>
            <Boton tamano="sm" onClick={() => navigate('/registro')}>
              <span className="hidden sm:inline">{t('comun.registrarNegocio')}</span>
              <span className="sm:hidden">{t('comun.registrarse')}</span>
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
              {t('landing.badge')}
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t('landing.heroTitulo')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              {t('landing.heroSubtitulo')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Boton tamano="lg" onClick={() => navigate('/registro')}>
                {t('landing.crearCuentaGratis')}
              </Boton>
              <Boton variante="secundario" tamano="lg" onClick={() => navigate('/login')}>
                {t('landing.yaTengoCuenta')}
              </Boton>
            </div>
          </motion.div>
        </section>

        {/* Características */}
        <Seccion className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
            {t('landing.caracteristicasTitulo')}
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {caracteristicas.map(({ icono: Icono, titulo, descripcion }, i) => (
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
              {t('landing.planesTitulo')}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('landing.planesSubtitulo')}
            </p>

            <TarjetasPlanes
              ctaGratis={
                <Boton
                  variante="secundario"
                  className="w-full"
                  onClick={() => navigate('/registro')}
                >
                  {t('landing.empezarGratis')}
                </Boton>
              }
              ctaPago={
                <Boton className="w-full" onClick={() => navigate('/registro')}>
                  {t('landing.empezarYActualizar')}
                </Boton>
              }
            />
          </div>
        </Seccion>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
        {t('landing.footer')}
      </footer>
    </div>
  );
}
