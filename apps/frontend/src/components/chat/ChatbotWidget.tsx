import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatbotSocket, type MensajeChat } from '@/lib/chatbot-socket';

const ETIQUETA_PANTALLA: Record<string, string> = {
  '/': 'Dashboard',
  '/calendario': 'Calendario',
  '/clientes': 'Clientes',
  '/servicios': 'Servicios',
  '/reservas': 'Reservas',
  '/notificaciones': 'Notificaciones',
  '/reportes': 'Reportes',
  '/suscripcion': 'Suscripción',
};

function pantallaActualDesde(pathname: string): string {
  return ETIQUETA_PANTALLA[pathname] ?? pathname;
}

function BurbujaMensaje({
  mensaje,
  textoPensando,
}: {
  mensaje: MensajeChat;
  textoPensando: string;
}) {
  if (mensaje.rol === 'sistema') {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{mensaje.texto}</span>
      </div>
    );
  }

  const esUsuario = mensaje.rol === 'usuario';
  return (
    <div className={cn('flex', esUsuario ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
          esUsuario
            ? 'rounded-br-sm bg-primary-600 text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
        )}
      >
        {mensaje.texto || (mensaje.enProgreso ? textoPensando : '')}
        {mensaje.enProgreso && (
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
        )}
      </div>
    </div>
  );
}

/**
 * Widget flotante del asistente contextual (punto 16 del brief): un solo
 * componente montado una vez en `AppLayout` (no repetido por pantalla).
 * Envía la pantalla actual (vía React Router) en cada pregunta — el rol
 * del usuario y los datos del negocio los resuelve el backend a partir
 * del JWT, nunca hace falta mandarlos desde aquí.
 */
export function ChatbotWidget() {
  const { t } = useTranslation();
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState('');
  const finMensajesRef = useRef<HTMLDivElement>(null);

  const { estado, mensajes, enviando, enviarMensaje } = useChatbotSocket(abierto);

  useEffect(() => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes]);

  const alEnviar = () => {
    const pregunta = borrador.trim();
    if (!pregunta || enviando || estado !== 'conectado') return;
    enviarMensaje(pregunta, pantallaActualDesde(location.pathname));
    setBorrador('');
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label={t('chat.titulo')}
            className="mb-3 flex h-[70vh] max-h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-primary-600 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-medium">{t('chat.titulo')}</span>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label={t('chat.cerrar')}
                className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              <BurbujaMensaje
                mensaje={{ id: 'bienvenida', rol: 'asistente', texto: t('chat.bienvenida') }}
                textoPensando={t('chat.pensando')}
              />
              {mensajes.map((mensaje) => (
                <BurbujaMensaje
                  key={mensaje.id}
                  mensaje={mensaje}
                  textoPensando={t('chat.pensando')}
                />
              ))}
              {estado === 'conectando' && (
                <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {t('chat.conectando')}
                </p>
              )}
              {estado === 'error' && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger dark:bg-red-900/30">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('chat.errorConexion')}</span>
                </div>
              )}
              <div ref={finMensajesRef} />
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
              <input
                type="text"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    alEnviar();
                  }
                }}
                placeholder={t('chat.placeholder')}
                disabled={estado !== 'conectado' || enviando}
                aria-label={t('chat.placeholder')}
                className="h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
              />
              <button
                type="button"
                onClick={alEnviar}
                disabled={!borrador.trim() || estado !== 'conectado' || enviando}
                aria-label={t('chat.enviar')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label={abierto ? t('chat.cerrar') : t('chat.abrir')}
        aria-expanded={abierto}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-700"
      >
        {abierto ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Bot className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
