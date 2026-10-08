import { describe, expect, it } from 'vitest';
import { EstadoNotificacion } from '../../../database/entities';
import { MotivoFallo } from '../motivo-fallo';
import { transicionPorEvento } from './transicion-por-evento';

const ev = (type: string, bounceType?: string) => ({
  type,
  data: { email_id: 'e1', ...(bounceType ? { bounce: { type: bounceType } } : {}) },
});
const enviada = { estado: EstadoNotificacion.ENVIADA, ultimoError: null };

describe('transicionPorEvento()', () => {
  it('delivered → entregada y limpia el motivo', () => {
    expect(transicionPorEvento(ev('email.delivered'), enviada)).toEqual({
      estado: EstadoNotificacion.ENTREGADA,
      ultimoError: null,
    });
  });

  it('delivery_delayed → sigue enviada, con motivo ENTREGA_DEMORADA', () => {
    expect(transicionPorEvento(ev('email.delivery_delayed'), enviada)).toEqual({
      estado: EstadoNotificacion.ENVIADA,
      ultimoError: MotivoFallo.ENTREGA_DEMORADA,
    });
  });

  it('bounced Permanent → fallida REBOTE_PERMANENTE; otro tipo → REBOTE_TEMPORAL', () => {
    expect(transicionPorEvento(ev('email.bounced', 'Permanent'), enviada)?.ultimoError).toBe(
      MotivoFallo.REBOTE_PERMANENTE,
    );
    expect(transicionPorEvento(ev('email.bounced', 'Transient'), enviada)).toEqual({
      estado: EstadoNotificacion.FALLIDA,
      ultimoError: MotivoFallo.REBOTE_TEMPORAL,
    });
  });

  it('complained → entregada con MARCADO_COMO_SPAM', () => {
    expect(transicionPorEvento(ev('email.complained'), enviada)).toEqual({
      estado: EstadoNotificacion.ENTREGADA,
      ultimoError: MotivoFallo.MARCADO_COMO_SPAM,
    });
  });

  it('failed → fallida RECHAZADO_POR_PROVEEDOR', () => {
    expect(transicionPorEvento(ev('email.failed'), enviada)).toEqual({
      estado: EstadoNotificacion.FALLIDA,
      ultimoError: MotivoFallo.RECHAZADO_POR_PROVEEDOR,
    });
  });

  it('un delivered tardío no pisa un rebote ni una queja', () => {
    expect(
      transicionPorEvento(ev('email.delivered'), {
        estado: EstadoNotificacion.FALLIDA,
        ultimoError: MotivoFallo.REBOTE_PERMANENTE,
      }),
    ).toBeNull();
    expect(
      transicionPorEvento(ev('email.delivered'), {
        estado: EstadoNotificacion.ENTREGADA,
        ultimoError: MotivoFallo.MARCADO_COMO_SPAM,
      }),
    ).toBeNull();
  });

  it('delivery_delayed después de entregada o fallida no cambia nada', () => {
    expect(
      transicionPorEvento(ev('email.delivery_delayed'), {
        estado: EstadoNotificacion.ENTREGADA,
        ultimoError: null,
      }),
    ).toBeNull();
  });

  it('eventos no manejados (opened, clicked, sent) → null', () => {
    for (const t of ['email.opened', 'email.clicked', 'email.sent', 'contact.created']) {
      expect(transicionPorEvento(ev(t), enviada)).toBeNull();
    }
  });
});
