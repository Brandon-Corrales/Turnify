import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PantallaCargando } from './PantallaCargando';

/** Envuelve cualquier ruta que requiera sesión; redirige a /login conservando de dónde venía. */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { estaAutenticado, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return <PantallaCargando />;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
