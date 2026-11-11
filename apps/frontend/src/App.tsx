import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { PantallaCargando } from '@/components/layout/PantallaCargando';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegistroPage = lazy(() => import('@/pages/RegistroPage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const InicioPage = lazy(() => import('@/pages/InicioPage'));
const CalendarioPage = lazy(() => import('@/pages/CalendarioPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const ReservaPublicaPage = lazy(() => import('@/pages/ReservaPublicaPage'));
const NotificacionesPage = lazy(() => import('@/pages/NotificacionesPage'));
const ReportesPage = lazy(() => import('@/pages/ReportesPage'));
const ClientesPage = lazy(() => import('@/pages/ClientesPage'));
const ServiciosPage = lazy(() => import('@/pages/ServiciosPage'));
const ReservasPage = lazy(() => import('@/pages/ReservasPage'));
const SuscripcionPage = lazy(() => import('@/pages/SuscripcionPage'));
const SuscripcionExitoPage = lazy(() => import('@/pages/SuscripcionExitoPage'));
const SuscripcionCanceladaPage = lazy(() => import('@/pages/SuscripcionCanceladaPage'));
const ConfiguracionPage = lazy(() => import('@/pages/ConfiguracionPage'));
const NoEncontradoPage = lazy(() => import('@/pages/NoEncontradoPage'));

/**
 * "/" es pública (Landing, punto 6 del brief) para quien no tiene sesión,
 * y el Dashboard para quien sí — a diferencia del resto de rutas
 * autenticadas, no puede usar RutaProtegida (que siempre redirige a
 * /login) porque los visitantes anónimos deben poder verla.
 */
function Raiz() {
  const { estaAutenticado, cargando } = useAuth();
  if (cargando) return <PantallaCargando />;
  return estaAutenticado ? <InicioPage /> : <LandingPage />;
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PantallaCargando />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/" element={<Raiz />} />
          <Route path="/reservar/:idNegocio" element={<ReservaPublicaPage />} />
          <Route
            path="/calendario"
            element={
              <RutaProtegida>
                <CalendarioPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RutaProtegida>
                <OnboardingPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <RutaProtegida>
                <NotificacionesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/reportes"
            element={
              <RutaProtegida>
                <ReportesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/clientes"
            element={
              <RutaProtegida>
                <ClientesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/servicios"
            element={
              <RutaProtegida>
                <ServiciosPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/reservas"
            element={
              <RutaProtegida>
                <ReservasPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/suscripcion"
            element={
              <RutaProtegida>
                <SuscripcionPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/suscripcion/exito"
            element={
              <RutaProtegida>
                <SuscripcionExitoPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/suscripcion/cancelada"
            element={
              <RutaProtegida>
                <SuscripcionCanceladaPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/configuracion"
            element={
              <RutaProtegida>
                <ConfiguracionPage />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<NoEncontradoPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
