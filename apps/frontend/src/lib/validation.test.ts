import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { crearNuevaReservaSchema } from './validation';

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
