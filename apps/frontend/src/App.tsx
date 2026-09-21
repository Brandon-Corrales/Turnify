import { Route, Routes } from 'react-router-dom';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { PantallaCargando } from '@/components/layout/PantallaCargando';
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import RegistroPage from '@/pages/RegistroPage';
import LandingPage from '@/pages/LandingPage';
import InicioPage from '@/pages/InicioPage';
import CalendarioPage from '@/pages/CalendarioPage';
import OnboardingPage from '@/pages/OnboardingPage';
import ReservaPublicaPage from '@/pages/ReservaPublicaPage';
import NotificacionesPage from '@/pages/NotificacionesPage';
import ReportesPage from '@/pages/ReportesPage';
import ClientesPage from '@/pages/ClientesPage';
import ServiciosPage from '@/pages/ServiciosPage';
import ReservasPage from '@/pages/ReservasPage';
import SuscripcionPage from '@/pages/SuscripcionPage';
import SuscripcionExitoPage from '@/pages/SuscripcionExitoPage';
import SuscripcionCanceladaPage from '@/pages/SuscripcionCanceladaPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';

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
    </Routes>
  );
}

export default App;
