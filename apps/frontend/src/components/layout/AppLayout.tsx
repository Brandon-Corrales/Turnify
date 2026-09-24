import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ChatbotWidget } from '@/components/chat/ChatbotWidget';
import { ControlesGlobales } from './ControlesGlobales';

/**
 * Barra superior de las pantallas autenticadas. El grupo de controles
 * globales (punto 9: vista/tema/idioma) vive en `ControlesGlobales` — hoy
 * solo trae el selector de idioma; vista y tema se suman ahí mismo en sus
 * propias tarjetas, sin reestructurar este navbar.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const esAdmin = usuario?.rol === 'admin';
  const enlaces = [
    { to: '/calendario', label: t('comun.calendario'), icon: CalendarDays },
    { to: '/clientes', label: t('comun.clientes'), icon: Users },
    { to: '/servicios', label: t('comun.servicios'), icon: Scissors },
    { to: '/reservas', label: t('comun.reservas'), icon: ClipboardList },
    { to: '/notificaciones', label: t('comun.notificaciones'), icon: Bell },
    { to: '/reportes', label: t('comun.reportes'), icon: BarChart3 },
    { to: '/suscripcion', label: t('comun.suscripcion'), icon: CreditCard },
    { to: '/configuracion', label: t('comun.configuracion'), icon: Settings },
  ] satisfies { to: string; label: string; icon: LucideIcon }[];

  const alCerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (esAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {sidebarAbierto && (
          <button
            type="button"
            aria-label={t('comun.cerrar')}
            onClick={() => setSidebarAbierto(false)}
            className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-violet-500/20 bg-slate-950/95 shadow-[10px_0_35px_rgba(76,29,149,0.2)] backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
            sidebarAbierto ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
            <Link
              to="/"
              onClick={() => setSidebarAbierto(false)}
              className="text-xl font-semibold tracking-wide text-violet-300 transition-colors hover:text-white"
            >
              {t('comun.turnify')}
            </Link>
            <button
              type="button"
              aria-label={t('comun.cerrar')}
              onClick={() => setSidebarAbierto(false)}
              className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Navegación principal" className="flex-1 space-y-1 px-3 py-6">
            {enlaces.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarAbierto(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 border-l-4 px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300 shadow-[inset_8px_0_22px_-18px_rgba(167,139,250,0.95),0_0_18px_-12px_rgba(139,92,246,0.9)]'
                      : 'border-transparent text-slate-400 hover:border-violet-400/50 hover:bg-white/5 hover:text-violet-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 transition-colors duration-200 ${
                        isActive ? 'text-violet-300' : 'text-slate-500 group-hover:text-violet-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-4 border-t border-white/10 p-4">
            <ControlesGlobales />
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-slate-300">{usuario?.nombreCompleto}</span>
              <button
                type="button"
                onClick={alCerrarSesion}
                aria-label={t('comun.cerrarSesion')}
                className="shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-violet-200"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <button
            type="button"
            aria-label="Abrir navegación"
            aria-expanded={sidebarAbierto}
            onClick={() => setSidebarAbierto(true)}
            className="rounded-md p-2 text-slate-600 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/" className="text-lg font-semibold text-violet-600 dark:text-violet-300">
            {t('comun.turnify')}
          </Link>
          <ControlesGlobales />
        </header>

        <main className="min-w-0 lg:ml-64">{children}</main>
        <ChatbotWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        {/*
          min-w-0 en ambos contenedores flex es lo que de verdad habilita
          el overflow-x-auto del <nav> — sin esto, un item de flexbox
          nunca se encoge más allá del tamaño de su contenido (min-width:
          auto por defecto) y el header entero se desborda en mobile en
          vez de dejar que solo la tira de links haga scroll horizontal
          propio (punto 12 del brief: nunca scroll horizontal del body).
        */}
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/"
            className="shrink-0 text-lg font-semibold text-primary-600 dark:text-primary-400"
          >
            {t('comun.turnify')}
          </Link>
          <nav className="flex min-w-0 gap-4 overflow-x-auto">
            <Link
              to="/calendario"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.calendario')}
            </Link>
            <Link
              to="/clientes"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.clientes')}
            </Link>
            <Link
              to="/servicios"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.servicios')}
            </Link>
            <Link
              to="/reservas"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.reservas')}
            </Link>
            <Link
              to="/notificaciones"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.notificaciones')}
            </Link>
            <Link
              to="/reportes"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.reportes')}
            </Link>
            <Link
              to="/suscripcion"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.suscripcion')}
            </Link>
            <Link
              to="/configuracion"
              className="shrink-0 text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              {t('comun.configuracion')}
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ControlesGlobales />
          <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">
            {usuario?.nombreCompleto}
          </span>
          <button
            type="button"
            onClick={alCerrarSesion}
            aria-label={t('comun.cerrarSesion')}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main>{children}</main>
      <ChatbotWidget />
    </div>
  );
}
