import { Route, Routes } from 'react-router-dom';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import LoginPage from '@/pages/LoginPage';
import RegistroPage from '@/pages/RegistroPage';
import InicioPage from '@/pages/InicioPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route
        path="/"
        element={
          <RutaProtegida>
            <InicioPage />
          </RutaProtegida>
        }
      />
    </Routes>
  );
}

export default App;
