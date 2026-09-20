import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Barra superior mínima para las pantallas autenticadas: sin esto, llegar
 * a /calendario no tendría forma de volver a Inicio ni de cerrar sesión
 * sin escribir URLs a mano. El AppShell real con controles globales
 * (punto 8: vista, tema, idioma) es trabajo de tarjetas futuras — esto
 * solo cubre la navegación mínima indispensable de esta tarjeta.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const alCerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-primary-600 dark:text-primary-400">
            Turnify
          </Link>
          <Link
            to="/calendario"
            className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
          >
            Calendario
          </Link>
          <Link
            to="/notificaciones"
            className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
          >
            Notificaciones
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">
            {usuario?.nombreCompleto}
          </span>
          <button
            type="button"
            onClick={alCerrarSesion}
            aria-label="Cerrar sesión"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
