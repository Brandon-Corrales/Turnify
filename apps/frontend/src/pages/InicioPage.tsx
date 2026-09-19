import { useNavigate } from 'react-router-dom';
import { Boton } from '@/components/ui';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';

/**
 * Home autenticada provisional: el Dashboard de verdad (KPIs, punto 5 del
 * brief) es una tarjeta de después del Seguimiento #2 — esto solo da un
 * punto de entrada hacia el Calendario, que sí es la pantalla real de
 * esta fase.
 */
export default function InicioPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-2xl font-semibold text-primary-600 dark:text-primary-400">Turnify</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Bienvenido, <span className="font-medium">{usuario?.nombreCompleto}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {usuario?.correoElectronico} · {usuario?.rol}
          </p>
          <Boton className="mt-6 w-full" onClick={() => navigate('/calendario')}>
            Ver calendario
          </Boton>
        </div>
      </div>
    </AppLayout>
  );
}
