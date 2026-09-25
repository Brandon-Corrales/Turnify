import { MutationCache, QueryClient } from '@tanstack/react-query';

export const queryClient: QueryClient = new QueryClient({
  // Cualquier mutación exitosa deja viejas TODAS las queries: un cambio en
  // una pantalla (ej. crear reserva en el Calendario) también se refleja en
  // las que dependen de lo mismo (Reservas, Reportes, Inicio) sin refrescar
  // la página ni tener que listar a mano cada queryKey relacionada. Solo se
  // vuelven a pedir las que están en pantalla. Los cambios hechos por OTRA
  // persona llegan por WebSocket (ver lib/tiempo-real.ts).
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries(),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Red de seguridad si el WebSocket estuvo caído: al volver a la
      // pestaña se recargan los datos viejos.
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
