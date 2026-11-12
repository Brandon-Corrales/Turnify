import { describe, expect, it } from 'vitest';
import { crearClienteSchema, crearDatosClientePublicoSchema } from './validation';

describe('teléfono internacional en los formularios de cliente (Bloque 5, punto 5.3)', () => {
  const tFalso = ((clave: string) => clave) as unknown as Parameters<typeof crearClienteSchema>[0];
  const base = {
    nombreCompleto: 'Prueba Globalizacion',
    correoElectronico: 'cliente@example.com',
    canalPreferido: 'email' as const,
    idiomaPreferido: 'es' as const,
    nivelCliente: 'gratis' as const,
  };
  const errorTelefono = (r: ReturnType<ReturnType<typeof crearClienteSchema>['safeParse']>) =>
    r.success ? undefined : r.error.issues.find((i) => i.path[0] === 'telefono')?.message;

  it('acepta un número válido para el país elegido y el teléfono vacío', () => {
    const schema = crearClienteSchema(tFalso);
    expect(schema.safeParse({ ...base, telefono: '8888-0000', paisTelefono: 'CR' }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ ...base, telefono: '(201) 555-0123', paisTelefono: 'US' }).success,
    ).toBe(true);
    expect(schema.safeParse({ ...base, telefono: '', paisTelefono: 'CR' }).success).toBe(true);
  });

  it('rechaza un número que no corresponde al país, con el mensaje traducible', () => {
    const r = crearClienteSchema(tFalso).safeParse({
      ...base,
      telefono: '8888-0000',
      paisTelefono: 'US',
    });
    expect(errorTelefono(r)).toBe('validacion.telefonoInvalido');
  });

  it('la reserva pública valida igual', () => {
    const r = crearDatosClientePublicoSchema(tFalso).safeParse({
      nombreCompleto: 'Prueba Globalizacion',
      correoElectronico: 'cliente@example.com',
      telefono: '123',
      paisTelefono: 'CR',
    });
    expect(r.success).toBe(false);
  });
});
