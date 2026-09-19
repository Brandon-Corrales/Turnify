import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Boton, Input, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { registroSchema, type RegistroFormValues } from '@/lib/validation';

export default function RegistroPage() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const mostrarToast = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormValues>({ resolver: zodResolver(registroSchema) });

  const alEnviar = async (valores: RegistroFormValues) => {
    try {
      await registrar({ ...valores, telefonoNegocio: valores.telefonoNegocio || undefined });
      mostrarToast({
        variante: 'exito',
        titulo: 'Negocio registrado',
        descripcion: 'Ya puedes empezar a usar Turnify',
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === 'EMAIL_YA_REGISTRADO') {
        setError('correoAdmin', { message: error.message });
        return;
      }
      const mensaje =
        error instanceof ApiError ? error.message : 'No se pudo completar el registro';
      mostrarToast({ variante: 'error', titulo: mensaje });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-center text-2xl font-semibold text-primary-600 dark:text-primary-400">
          Turnify
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Registra tu negocio y su administrador
        </p>

        <form onSubmit={handleSubmit(alEnviar)} noValidate className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre del negocio"
              requerido
              error={errors.nombreNegocio?.message}
              {...register('nombreNegocio')}
            />
            <Input
              label="Tipo de negocio"
              placeholder="barbería, clínica, academia..."
              requerido
              error={errors.tipoNegocio?.message}
              {...register('tipoNegocio')}
            />
          </div>
          <Input
            label="Correo del negocio"
            type="email"
            requerido
            error={errors.correoNegocio?.message}
            {...register('correoNegocio')}
          />
          <Input
            label="Teléfono del negocio"
            type="tel"
            hint="Opcional"
            error={errors.telefonoNegocio?.message}
            {...register('telefonoNegocio')}
          />

          <hr className="my-2 border-slate-200 dark:border-slate-700" />

          <Input
            label="Nombre completo del administrador"
            requerido
            error={errors.nombreCompletoAdmin?.message}
            {...register('nombreCompletoAdmin')}
          />
          <Input
            label="Correo del administrador"
            type="email"
            autoComplete="email"
            requerido
            error={errors.correoAdmin?.message}
            {...register('correoAdmin')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            requerido
            hint="Mínimo 8 caracteres, con al menos una letra y un número"
            error={errors.contrasena?.message}
            {...register('contrasena')}
          />

          <Boton type="submit" cargando={isSubmitting} className="mt-2 w-full">
            Crear cuenta
          </Boton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
