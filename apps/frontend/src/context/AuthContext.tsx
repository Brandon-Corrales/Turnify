import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Boton } from '@/components/ui';
import { ApiError, registrarAlSesionExpirada } from '@/lib/api';
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
  const { t } = useTranslation();
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null);
  const [cargando, setCargando] = useState(() =>
    Boolean(obtenerAccessToken() || obtenerRefreshToken()),
  );
  const [errorTransitorio, setErrorTransitorio] = useState(false);

  // El cliente HTTP avisa aquí cuando ni el access ni el refresh token
  // sirven ya (revocado, expirado) — limpia la sesión del lado de React
  // para que las rutas protegidas redirijan a /login.
  useEffect(() => {
    registrarAlSesionExpirada(() => setUsuario(null));
  }, []);

  const restaurarSesion = useCallback(async () => {
    if (!obtenerAccessToken() && !obtenerRefreshToken()) {
      setCargando(false);
      setErrorTransitorio(false);
      return;
    }
    setCargando(true);
    setErrorTransitorio(false);

    try {
      const perfil = await authApi.obtenerPerfil();
      setUsuario(perfil);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 401) {
        limpiarTokens();
        setUsuario(null);
      } else {
        // Red caída, 429, 5xx: conservar tokens y mostrar opción de reintentar
        setErrorTransitorio(true);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!obtenerAccessToken() && !obtenerRefreshToken()) {
      return;
    }
    let cancelado = false;
    authApi
      .obtenerPerfil()
      .then((perfil) => {
        if (!cancelado) setUsuario(perfil);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        if (err instanceof ApiError && err.statusCode === 401) {
          limpiarTokens();
          setUsuario(null);
        } else {
          setErrorTransitorio(true);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

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

  if (errorTransitorio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center dark:bg-slate-900">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('errores.errorConexionTitulo', 'Problema de conexión')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'errores.errorConexionDescripcion',
              'No pudimos conectar con el servidor para verificar tu sesión. Tus credenciales siguen seguras.',
            )}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Boton onClick={() => restaurarSesion()}>{t('comun.reintentar', 'Reintentar')}</Boton>
            <Boton variante="secundario" onClick={() => logout()}>
              {t('auth.cerrarSesion', 'Cerrar sesión')}
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Excepción justificada (Bloque 6, punto 6.7): separar este hook del
// proveedor obliga a reestructurar el archivo, que es del Bloque 2, y a
// cambiar los imports de las 16 pantallas que usan `useAuth`. La regla solo
// afecta a Fast Refresh en desarrollo: al editar este archivo se recarga la
// página completa en vez de solo el componente.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
