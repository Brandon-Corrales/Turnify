import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BASE_URL } from './api';
import { obtenerAccessToken } from './token-storage';

export type RolMensajeChat = 'usuario' | 'asistente' | 'sistema';

export interface MensajeChat {
  id: string;
  rol: RolMensajeChat;
  texto: string;
  /** true mientras llegan fragmentos de streaming para este mensaje del asistente. */
  enProgreso?: boolean;
}

interface ErrorChatbot {
  statusCode: number;
  errorCode: string;
  message: string;
}

export type EstadoConexionChat = 'inactivo' | 'conectando' | 'conectado' | 'error';

/**
 * Cliente del Chatbot (punto 16 del brief): WebSocket propio (namespace
 * `/chatbot`, mismo protocolo que expone `ChatbotGateway` en el backend —
 * emitir 'mensaje', escuchar 'respuesta-chunk'/'respuesta-fin'/
 * 'error-chatbot'). Streaming real: cada fragmento se concatena al último
 * mensaje del asistente en vez de esperar la respuesta completa.
 *
 * Conexión perezosa (`activo`): el socket solo se abre mientras el widget
 * está desplegado, no en cada pantalla desde que carga la app — evita
 * mantener una conexión WS ociosa por sesión cuando nadie usa el chat.
 */
export function useChatbotSocket(activo: boolean) {
  const socketRef = useRef<Socket | null>(null);
  // 'conectado'/'error' se derivan de estos dos flags en vez de guardar el
  // estado combinado directo — así el efecto de abajo solo llama setState
  // dentro de los callbacks de los eventos del socket (nunca de forma
  // síncrona en el cuerpo del efecto), como pide react-hooks/set-state-in-effect.
  const [conectado, setConectado] = useState(false);
  const [conexionFallida, setConexionFallida] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [enviando, setEnviando] = useState(false);

  const estado: EstadoConexionChat = !activo
    ? 'inactivo'
    : conexionFallida
      ? 'error'
      : conectado
        ? 'conectado'
        : 'conectando';

  useEffect(() => {
    if (!activo) return;

    // Defensivo: en la práctica este hook solo se activa dentro de AppLayout,
    // que ya garantiza sesión iniciada — sin token simplemente no se conecta
    // (el estado se queda en 'conectando', nunca debería observarse en uso real).
    const token = obtenerAccessToken();
    if (!token) return;

    const socket = io(`${BASE_URL}/chatbot`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConectado(true));
    socket.on('connect_error', () => setConexionFallida(true));
    socket.on('disconnect', () => setConectado(false));

    socket.on('respuesta-chunk', (fragmento: string) => {
      setMensajes((actuales) => {
        const ultimo = actuales[actuales.length - 1];
        if (ultimo?.rol === 'asistente' && ultimo.enProgreso) {
          const copia = actuales.slice(0, -1);
          copia.push({ ...ultimo, texto: ultimo.texto + fragmento });
          return copia;
        }
        return [
          ...actuales,
          { id: crypto.randomUUID(), rol: 'asistente', texto: fragmento, enProgreso: true },
        ];
      });
    });

    socket.on('respuesta-fin', () => {
      setEnviando(false);
      setMensajes((actuales) => {
        const ultimo = actuales[actuales.length - 1];
        if (!ultimo || ultimo.rol !== 'asistente') return actuales;
        const copia = actuales.slice(0, -1);
        copia.push({ ...ultimo, enProgreso: false });
        return copia;
      });
    });

    socket.on('error-chatbot', (error: ErrorChatbot) => {
      setEnviando(false);
      setMensajes((actuales) => [
        ...actuales,
        { id: crypto.randomUUID(), rol: 'sistema', texto: error.message },
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
      setConexionFallida(false);
    };
  }, [activo]);

  const enviarMensaje = useCallback(
    (pregunta: string, pantallaActual?: string) => {
      const socket = socketRef.current;
      if (!socket || estado !== 'conectado') return;
      setMensajes((actuales) => [
        ...actuales,
        { id: crypto.randomUUID(), rol: 'usuario', texto: pregunta },
      ]);
      setEnviando(true);
      socket.emit('mensaje', { pregunta, pantallaActual });
    },
    [estado],
  );

  return { estado, mensajes, enviando, enviarMensaje };
}
