import { describe, expect, it } from 'vitest';
import { esAnuladaPorReprogramacion, esFalloReal, estadoVisible } from './estado-notificacion';

describe('notificaciones anuladas por reprogramación (Bloque 4, punto 4.3)', () => {
  const anulada = { estado: 'fallida', ultimoError: 'REPROGRAMADA' } as const;
  const fallida = { estado: 'fallida', ultimoError: 'RECHAZADO_POR_PROVEEDOR' } as const;

  it('una FALLIDA con motivo REPROGRAMADA se muestra como anulada y no es un fallo', () => {
    expect(esAnuladaPorReprogramacion(anulada)).toBe(true);
    expect(esFalloReal(anulada)).toBe(false);
    expect(estadoVisible(anulada)).toBe('anulada');
  });

  it('una FALLIDA con otro motivo, o sin motivo, sigue siendo fallida', () => {
    expect(esFalloReal(fallida)).toBe(true);
    expect(estadoVisible(fallida)).toBe('fallida');
    expect(esFalloReal({ estado: 'fallida', ultimoError: null })).toBe(true);
  });

  it('un conteo de fallos con esFalloReal no incluye las anuladas', () => {
    const historial = [anulada, fallida, { estado: 'enviada', ultimoError: null } as const];
    expect(historial.filter(esFalloReal)).toHaveLength(1);
  });

  it('los demás estados se muestran igual', () => {
    for (const estado of ['pendiente', 'enviada', 'entregada'] as const) {
      expect(estadoVisible({ estado, ultimoError: null })).toBe(estado);
    }
  });
});
