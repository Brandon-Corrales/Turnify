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
    </Routes>
  );
}

export default App;
