import { describe, expect, it } from 'vitest';
import {
  clasificarRechazoProveedor,
  esAnuladaPorReprogramacion,
  esFalloReal,
  MotivoFallo,
  motivoPublico,
} from './motivo-fallo';

describe('clasificarRechazoProveedor()', () => {
  it('Resend sin dominio verificado → destinatario no habilitado', () => {
    expect(
      clasificarRechazoProveedor(
        'You can only send testing emails to your own email address (duena@cuenta.test). To send emails to other recipients, please verify a domain',
      ),
    ).toBe(MotivoFallo.DESTINATARIO_NO_HABILITADO);
  });

  it('WhatsApp 131030 (número fuera de la lista de prueba) → destinatario no habilitado', () => {
    expect(
      clasificarRechazoProveedor(
        '{"error":{"code":131030,"message":"Recipient phone number not in allowed list"}}',
      ),
    ).toBe(MotivoFallo.DESTINATARIO_NO_HABILITADO);
  });

  it('cualquier otro rechazo → rechazado por el proveedor', () => {
    expect(clasificarRechazoProveedor('Invalid `to` field.')).toBe(
      MotivoFallo.RECHAZADO_POR_PROVEEDOR,
    );
  });
});

describe('motivoPublico()', () => {
  it('deja pasar los códigos conocidos', () => {
    expect(motivoPublico('CREDENCIALES_FALTANTES')).toBe(MotivoFallo.CREDENCIALES_FALTANTES);
  });

  it('nunca deja salir texto libre: lo convierte en la categoría genérica', () => {
    expect(motivoPublico('You can only send testing emails to x@y.com')).toBe(
      MotivoFallo.RECHAZADO_POR_PROVEEDOR,
    );
  });

  it('null o vacío → null', () => {
    expect(motivoPublico(null)).toBeNull();
    expect(motivoPublico('')).toBeNull();
  });
});

describe('anuladas por reprogramación (Bloque 4, punto 4.3)', () => {
  it('motivoPublico deja pasar REPROGRAMADA (el frontend la traduce)', () => {
    expect(motivoPublico('REPROGRAMADA')).toBe(MotivoFallo.REPROGRAMADA);
  });

  it('una FALLIDA con motivo REPROGRAMADA no es un fallo real', () => {
    expect(esAnuladaPorReprogramacion('fallida', MotivoFallo.REPROGRAMADA)).toBe(true);
    expect(esFalloReal('fallida', MotivoFallo.REPROGRAMADA)).toBe(false);
  });

  it('una FALLIDA con cualquier otro motivo (o sin motivo) sí es un fallo real', () => {
    expect(esFalloReal('fallida', MotivoFallo.RECHAZADO_POR_PROVEEDOR)).toBe(true);
    expect(esFalloReal('fallida', null)).toBe(true);
    expect(esAnuladaPorReprogramacion('fallida', MotivoFallo.REBOTE_PERMANENTE)).toBe(false);
  });

  it('los demás estados nunca son fallos', () => {
    for (const estado of ['pendiente', 'enviada', 'entregada']) {
      expect(esFalloReal(estado, MotivoFallo.ENTREGA_DEMORADA)).toBe(false);
      expect(esAnuladaPorReprogramacion(estado, MotivoFallo.REPROGRAMADA)).toBe(false);
    }
  });
});
