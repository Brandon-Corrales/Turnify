import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
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

  const alCerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

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
