import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/** Envuelve cualquier ruta que requiera sesión; redirige a /login conservando de dónde venía. */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { estaAutenticado, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Cargando sesión" />
      </div>
    );
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
