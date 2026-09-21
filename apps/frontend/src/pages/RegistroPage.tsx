import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Boton, Input, Select, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { crearRegistroSchema, type RegistroFormValues } from '@/lib/validation';
import { crearEtiquetaTipoNegocio, TIPOS_NEGOCIO } from '@/lib/tipo-negocio';

export default function RegistroPage() {
  const { t } = useTranslation();
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const mostrarToast = useToast();

  const opcionesTipoNegocio = useMemo(() => {
    const etiqueta = crearEtiquetaTipoNegocio(t);
    return TIPOS_NEGOCIO.map((valor) => ({ value: valor, label: etiqueta[valor] }));
  }, [t]);

  const registroSchema = useMemo(() => crearRegistroSchema(t), [t]);
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
        titulo: t('registro.exitoTitulo'),
        descripcion: t('registro.exitoDescripcion'),
      });
      navigate('/onboarding', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === 'EMAIL_YA_REGISTRADO') {
        setError('correoAdmin', { message: error.message });
        return;
      }
      const mensaje = error instanceof ApiError ? error.message : t('registro.errorGenerico');
      mostrarToast({ variante: 'error', titulo: mensaje });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-center text-2xl font-semibold text-primary-600 dark:text-primary-400">
          {t('comun.turnify')}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('registro.subtitulo')}
        </p>

        <form onSubmit={handleSubmit(alEnviar)} noValidate className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('registro.nombreNegocio')}
              variante="crear"
              requerido
              error={errors.nombreNegocio?.message}
              {...register('nombreNegocio')}
            />
            <Select
              label={t('registro.tipoNegocio')}
              variante="crear"
              placeholder={t('registro.seleccionaUno')}
              requerido
              opciones={opcionesTipoNegocio}
              error={errors.tipoNegocio?.message}
              {...register('tipoNegocio')}
            />
          </div>
          <Input
            label={t('registro.correoNegocio')}
            type="email"
            variante="crear"
            requerido
            error={errors.correoNegocio?.message}
            {...register('correoNegocio')}
          />
          <Input
            label={t('registro.telefonoNegocio')}
            type="tel"
            variante="crear"
            hint={t('comun.opcional')}
            error={errors.telefonoNegocio?.message}
            {...register('telefonoNegocio')}
          />

          <hr className="my-2 border-slate-200 dark:border-slate-700" />

          <Input
            label={t('registro.nombreCompletoAdmin')}
            variante="crear"
            requerido
            error={errors.nombreCompletoAdmin?.message}
            {...register('nombreCompletoAdmin')}
          />
          <Input
            label={t('registro.correoAdmin')}
            type="email"
            autoComplete="email"
            variante="crear"
            requerido
            error={errors.correoAdmin?.message}
            {...register('correoAdmin')}
          />
          <Input
            label={t('comun.contrasena')}
            type="password"
            autoComplete="new-password"
            variante="crear"
            requerido
            hint={t('registro.hintContrasena')}
            error={errors.contrasena?.message}
            {...register('contrasena')}
          />

          <Boton type="submit" cargando={isSubmitting} className="mt-2 w-full">
            {t('registro.crearCuenta')}
          </Boton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('registro.yaTienesCuenta')}{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {t('comun.iniciarSesion')}
          </Link>
        </p>
      </div>
    </div>
  );
}
