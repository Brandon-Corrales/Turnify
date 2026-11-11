import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
  calcularFortalezaContrasena,
  crearContrasenaSchema,
  crearNuevaReservaSchema,
} from './validation';

const t = ((clave: string) => clave) as unknown as TFunction;
const schema = crearNuevaReservaSchema(t);

const base = {
  idServicio: 's1',
  idUsuario: 'u1',
  fecha: '2026-10-08',
  hora: '10:00',
  notas: '',
  idCliente: '',
  nuevoCliente: { nombreCompleto: '', correoElectronico: '', telefono: '' },
};

/** Primer mensaje por campo, igual que lo muestra el formulario (zodResolver). */
function erroresDe(valores: object) {
  const r = schema.safeParse(valores);
  const errores: Record<string, string> = {};
  if (!r.success) {
    for (const i of r.error.issues) errores[i.path.join('.')] ??= i.message;
  }
  return errores;
}

describe('crearNuevaReservaSchema() — reserva manual del Calendario', () => {
  it('con cliente existente exige elegir uno', () => {
    expect(erroresDe({ ...base, modoCliente: 'existente' })).toEqual({
      idCliente: 'validacion.seleccionaCliente',
    });
  });

  it('con cliente existente elegido es válida y no valida los campos del cliente nuevo', () => {
    expect(erroresDe({ ...base, modoCliente: 'existente', idCliente: 'c1' })).toEqual({});
  });

  it('con cliente nuevo aplica las mismas reglas que el formulario de Clientes', () => {
    const errores = erroresDe({
      ...base,
      modoCliente: 'nuevo',
      nuevoCliente: { nombreCompleto: 'A', correoElectronico: 'no-es-correo', telefono: '' },
    });
    expect(errores).toEqual({
      'nuevoCliente.nombreCompleto': 'validacion.minimo2Caracteres',
      'nuevoCliente.correoElectronico': 'validacion.correoInvalido',
    });
  });

  it('con cliente nuevo exige el correo', () => {
    const errores = erroresDe({
      ...base,
      modoCliente: 'nuevo',
      nuevoCliente: { nombreCompleto: 'Ana Pérez', correoElectronico: '', telefono: '' },
    });
    expect(errores['nuevoCliente.correoElectronico']).toBe('validacion.correoObligatorio');
  });

  it('con cliente nuevo válido no exige idCliente (el teléfono es opcional)', () => {
    expect(
      erroresDe({
        ...base,
        modoCliente: 'nuevo',
        nuevoCliente: {
          nombreCompleto: 'Ana Pérez',
          correoElectronico: 'ana@ejemplo.com',
          telefono: '',
        },
      }),
    ).toEqual({});
  });
});

describe('crearContrasenaSchema y calcularFortalezaContrasena', () => {
  const contrasenaSchema = crearContrasenaSchema(t);

  it('rechaza contraseñas menores a 12 caracteres o comunes', () => {
    expect(contrasenaSchema.safeParse('Corta1').success).toBe(false);
    expect(contrasenaSchema.safeParse('password1234').success).toBe(false);
  });

  it('acepta contraseñas válidas de 12 a 64 caracteres con letras y números', () => {
    expect(contrasenaSchema.safeParse('Turnify.Segura.2026').success).toBe(true);
  });

  it('evalúa la fortaleza correctamente', () => {
    expect(calcularFortalezaContrasena('12345').nivel).toBe('debil');
    expect(calcularFortalezaContrasena('Clave12345678').nivel).toBe('media');
    expect(calcularFortalezaContrasena('ClaveSuper.Segura2026!').nivel).toBe('fuerte');
  });
});
