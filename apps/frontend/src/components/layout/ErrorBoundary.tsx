import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18next from 'i18next';
import { Boton } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  tieneError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    tieneError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { tieneError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error no controlado:', error, errorInfo);
  }

  public override render() {
    if (this.state.tieneError) {
      if (this.props.fallback) return this.props.fallback;

      const t = i18next.t.bind(i18next);
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center dark:bg-slate-900">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('errores.errorInesperadoTitulo', 'Algo salió mal')}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t(
                'errores.errorInesperadoDescripcion',
                'Ocurrió un error inesperado al renderizar esta sección.',
              )}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Boton onClick={() => this.setState({ tieneError: false })}>
                {t('comun.reintentar', 'Reintentar')}
              </Boton>
              <Boton variante="secundario" onClick={() => (window.location.href = '/')}>
                {t('comun.volverAlInicio', 'Volver al inicio')}
              </Boton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
