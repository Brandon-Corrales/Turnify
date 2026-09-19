import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Boton, Input, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '@/lib/validation';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mostrarToast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const destino = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const alEnviar = async (valores: LoginFormValues) => {
    try {
      await login(valores);
      navigate(destino, { replace: true });
    } catch (error) {
      const mensaje = error instanceof ApiError ? error.message : 'No se pudo iniciar sesión';
      mostrarToast({ variante: 'error', titulo: mensaje });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-center text-2xl font-semibold text-primary-600 dark:text-primary-400">
          Turnify
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Inicia sesión en tu negocio
        </p>

        <form onSubmit={handleSubmit(alEnviar)} noValidate className="mt-6 flex flex-col gap-4">
          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            requerido
            error={errors.correoElectronico?.message}
            {...register('correoElectronico')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            requerido
            error={errors.contrasena?.message}
            {...register('contrasena')}
          />
          <Boton type="submit" cargando={isSubmitting} className="mt-2 w-full">
            Iniciar sesión
          </Boton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ¿No tienes cuenta?{' '}
          <Link
            to="/registro"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Registra tu negocio
          </Link>
        </p>
      </div>
    </div>
  );
}
