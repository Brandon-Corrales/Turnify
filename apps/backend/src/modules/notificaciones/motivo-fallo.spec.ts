import { describe, expect, it } from 'vitest';
import { clasificarRechazoProveedor, MotivoFallo, motivoPublico } from './motivo-fallo';

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
