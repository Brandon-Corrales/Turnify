import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { BASE_URL } from './api';
import { obtenerAccessToken } from './token-storage';

const MS_REINTENTO = 5_000;

/**
 * Mantiene el panel sincronizado sin refrescar la página: escucha el
 * WebSocket `/eventos` del backend (TiempoRealGateway) y, cuando alguien
 * del mismo negocio cambia algo — otro empleado, el propio admin en otra
 * pestaña o un cliente desde el link público —, marca todas las queries
 * como viejas. React Query solo vuelve a pedir las que están en pantalla;
 * las demás se recargan al abrirse.
 *
 * `auth` como función (no objeto fijo): en cada reconexión se lee el
 * access token vigente, no el que existía cuando se montó el layout.
 */
export function useSincronizacionTiempoReal(activo: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activo) return;

    const socket = io(`${BASE_URL}/eventos`, {
      auth: (cb) => cb({ token: obtenerAccessToken() }),
      transports: ['websocket'],
    });

    const recargar = () => queryClient.invalidateQueries();
    let conectadoAntes = false;

    socket.on('datos-cambiados', recargar);
    // Tras una caída de red pudieron perderse avisos: al reconectar se
    // recarga todo una vez (no en la primera conexión — ya está fresco).
    socket.on('connect', () => {
      if (conectadoAntes) recargar();
      conectadoAntes = true;
    });

    // Si el backend corta la conexión (token vencido al reconectar),
    // socket.io no reintenta solo; se reintenta con el token que para
    // entonces ya renovó el cliente HTTP.
    let reintento: ReturnType<typeof setTimeout> | undefined;
    socket.on('disconnect', (motivo) => {
      if (motivo === 'io server disconnect') {
        reintento = setTimeout(() => socket.connect(), MS_REINTENTO);
      }
    });

    return () => {
      clearTimeout(reintento);
      socket.disconnect();
    };
  }, [activo, queryClient]);
}
