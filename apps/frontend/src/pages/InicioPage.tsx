import { useNavigate } from 'react-router-dom';
import { Boton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

/**
 * Home autenticada provisional: confirma que el login/registro deja al
 * usuario en una sesión real y funcional. El Dashboard de verdad (KPIs,
 * punto 5 del brief) es una tarjeta de después del Seguimiento #2 — esto
 * solo prueba que "Login/Registro conectado al módulo Auth" funciona de
 * punta a punta, no se adelanta al diseño real del Dashboard.
 */
export default function InicioPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const alCerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-2xl font-semibold text-primary-600 dark:text-primary-400">Turnify</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Bienvenido, <span className="font-medium">{usuario?.nombreCompleto}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {usuario?.correoElectronico} · {usuario?.rol}
        </p>
        <Boton variante="secundario" onClick={alCerrarSesion} className="mt-6 w-full">
          Cerrar sesión
        </Boton>
      </div>
    </main>
  );
}
