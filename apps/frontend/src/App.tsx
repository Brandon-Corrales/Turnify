import { Route, Routes } from 'react-router-dom';

/**
 * Placeholder de esta tarjeta de setup: confirma que Vite + Tailwind +
 * Router + TanStack Query arrancan juntos. Las rutas reales llegan con
 * cada pantalla (Login, Dashboard, Calendario, ...) en sus propias
 * tarjetas — no se adelantan aquí.
 */
function InicioProvisional() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-2xl font-semibold text-primary-600 dark:text-primary-400">Turnify</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Setup de frontend listo — Vite, TypeScript, Tailwind, React Router y TanStack Query.
        </p>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioProvisional />} />
    </Routes>
  );
}

export default App;
