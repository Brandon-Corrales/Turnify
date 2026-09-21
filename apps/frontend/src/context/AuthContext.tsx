import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { registrarAlSesionExpirada } from '@/lib/api';
import {
  authApi,
  type LoginPayload,
  type RegistroPayload,
  type UsuarioActual,
} from '@/lib/auth-api';
import {
  guardarTokens,
  limpiarTokens,
  obtenerAccessToken,
  obtenerRefreshToken,
} from '@/lib/token-storage';

interface AuthContextValue {
  usuario: UsuarioActual | null;
  cargando: boolean;
  estaAutenticado: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  registrar: (payload: RegistroPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null);
  const [cargando, setCargando] = useState(true);

  // El cliente HTTP avisa aquí cuando ni el access ni el refresh token
  // sirven ya (revocado, expirado) — limpia la sesión del lado de React
  // para que las rutas protegidas redirijan a /login.
  useEffect(() => {
    registrarAlSesionExpirada(() => setUsuario(null));
  }, []);

  // Restaura la sesión al recargar la página: si hay algún token
  // guardado, /auth/me confirma quién es (y si el access ya expiró, el
  // propio apiFetch lo refresca de forma transparente antes de esto).
  useEffect(() => {
    let cancelado = false;

    async function restaurarSesion() {
      if (!obtenerAccessToken() && !obtenerRefreshToken()) {
        setCargando(false);
        return;
      }
      try {
        const perfil = await authApi.obtenerPerfil();
        if (!cancelado) setUsuario(perfil);
      } catch {
        limpiarTokens();
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    restaurarSesion();
    return () => {
      cancelado = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { usuario: perfil, tokens } = await authApi.login(payload);
    guardarTokens(tokens.accessToken, tokens.refreshToken);
    setUsuario(perfil);
  }, []);

  const registrar = useCallback(async (payload: RegistroPayload) => {
    const { usuario: perfil, tokens } = await authApi.registrar(payload);
    guardarTokens(tokens.accessToken, tokens.refreshToken);
    setUsuario(perfil);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort: aunque falle la llamada, la sesión local igual se limpia.
    }
    limpiarTokens();
    setUsuario(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ usuario, cargando, estaAutenticado: usuario !== null, login, registrar, logout }),
    [usuario, cargando, login, registrar, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
