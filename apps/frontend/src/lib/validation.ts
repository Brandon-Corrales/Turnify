import { z } from 'zod';
import type { TFunction } from 'i18next';
import { TIPOS_NEGOCIO } from './tipo-negocio';
import { esPaisTelefono, normalizarTelefono } from './telefono';

/**
 * Cada schema es una función que recibe `t()` en vez de una constante — los
 * mensajes de error de validación son "contenido" igual que cualquier
 * label (punto 4 del feedback de QA: el cambio de idioma debe aplicar a
 * TODO, no solo al header). Se reconstruye en cada página con
 * `useMemo(() => crearXSchema(t), [t])` para que cambien al vuelo si el
 * usuario cambia de idioma con el formulario abierto.
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const NOMBRE_REGEX = /^[\p{L}]+(?:[ '\u002D][\p{L}]+)*$/u;
const TELEFONO_REGEX = /^\d+$/;

/**
 * Teléfono de cliente (Bloque 5, punto 5.3): número nacional + país. Se
 * aceptan espacios, guiones y paréntesis al escribir; la validación real (y
 * la conversión a E.164 al enviar) la hace `libphonenumber-js` según el país.
 */
function campoTelefono() {
  return z.string().max(25).optional().or(z.literal(''));
}

function campoPaisTelefono() {
  // Opcional: si falta, se toma Costa Rica (+506), el país por defecto.
  return z
    .string()
    .refine((valor): boolean => esPaisTelefono(valor))
    .optional();
}

function validarTelefono(
  valores: { telefono?: string; paisTelefono?: string },
  ctx: z.RefinementCtx,
  t: TFunction,
): void {
  if (!valores.telefono?.trim()) return;
  const pais = esPaisTelefono(valores.paisTelefono) ? valores.paisTelefono : undefined;
  if (!normalizarTelefono(valores.telefono, pais)) {
    ctx.addIssue({ code: 'custom', path: ['telefono'], message: t('validacion.telefonoInvalido') });
  }
}

const CONTRASENAS_COMUNES = new Set([
  '123456789012',
  'password1234',
  'contrasena12',
  'qwertyuiop12',
  'administrador',
  'turnify12345',
  'admin1234567',
  'welcome12345',
  'turnify202612',
]);

export function calcularFortalezaContrasena(contrasena: string): {
  puntaje: number;
  nivel: 'debil' | 'media' | 'fuerte';
  etiqueta: string;
} {
  if (!contrasena) return { puntaje: 0, nivel: 'debil', etiqueta: 'Muy débil' };
  let puntos = 0;
  if (contrasena.length >= 12) puntos += 1;
  if (contrasena.length >= 16) puntos += 1;
  if (/[A-Z]/.test(contrasena) && /[a-z]/.test(contrasena)) puntos += 1;
  if (/\d/.test(contrasena)) puntos += 1;
  if (/[^A-Za-z0-9]/.test(contrasena)) puntos += 1;
  if (CONTRASENAS_COMUNES.has(contrasena.toLowerCase())) puntos = 1;

  if (puntos >= 4) return { puntaje: puntos, nivel: 'fuerte', etiqueta: 'Fuerte' };
  if (puntos >= 2) return { puntaje: puntos, nivel: 'media', etiqueta: 'Media' };
  return { puntaje: puntos, nivel: 'debil', etiqueta: 'Débil' };
}

/**
 * Misma política que EsContrasenaValida() en el backend: 12-64 caracteres,
 * al menos una letra y un número, máximo 72 bytes en UTF-8 y sin contraseñas comunes.
 */
export function crearContrasenaSchema(t: TFunction) {
  const mensaje = t('validacion.contrasenaInvalida');
  return z
    .string()
    .min(12, mensaje)
    .max(64, mensaje)
    .regex(PASSWORD_REGEX, mensaje)
    .refine((val) => new TextEncoder().encode(val).length <= 72, {
      message: mensaje,
    })
    .refine((val) => !CONTRASENAS_COMUNES.has(val.toLowerCase()), {
      message: mensaje,
    });
}

export function crearLoginSchema(t: TFunction) {
  return z.object({
    correoElectronico: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .max(100)
      .email(t('validacion.correoInvalido')),
    contrasena: z.string().min(1, t('validacion.contrasenaObligatoria')).max(128),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof crearLoginSchema>>;

export function crearRegistroSchema(t: TFunction) {
  return z.object({
    nombreNegocio: z.string().min(2, t('validacion.minimo2Caracteres')).max(60),
    tipoNegocio: z.enum(TIPOS_NEGOCIO, t('validacion.tipoNegocioObligatorio')),
    correoNegocio: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .max(100)
      .email(t('validacion.correoInvalido')),
    telefonoNegocio: z
      .string()
      .max(15)
      .regex(TELEFONO_REGEX, t('validacion.soloNumeros'))
      .optional()
      .or(z.literal('')),
    nombreCompletoAdmin: z
      .string()
      .min(2, t('validacion.minimo2Caracteres'))
      .max(60)
      .regex(NOMBRE_REGEX, t('validacion.soloLetras')),
    correoAdmin: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .max(100)
      .email(t('validacion.correoInvalido')),
    contrasena: crearContrasenaSchema(t),
  });
}

export type RegistroFormValues = z.infer<ReturnType<typeof crearRegistroSchema>>;

export function crearDatosClientePublicoSchema(t: TFunction) {
  return z
    .object({
      nombreCompleto: z
        .string()
        .min(2, t('validacion.minimo2Caracteres'))
        .max(60)
        .regex(NOMBRE_REGEX, t('validacion.soloLetras')),
      correoElectronico: z
        .string()
        .min(1, t('validacion.correoObligatorio'))
        .max(100)
        .email(t('validacion.correoInvalido')),
      telefono: campoTelefono(),
      paisTelefono: campoPaisTelefono(),
      sitioWeb: z.string().optional(),
    })
    .superRefine((valores, ctx) => validarTelefono(valores, ctx, t));
}

export type DatosClientePublicoFormValues = z.infer<
  ReturnType<typeof crearDatosClientePublicoSchema>
>;

/** Campos del formulario de cliente, sin la validación cruzada país + número (para poder usar `.pick`). */
function camposCliente(t: TFunction) {
  return z.object({
    nombreCompleto: z
      .string()
      .min(2, t('validacion.minimo2Caracteres'))
      .max(60)
      .regex(NOMBRE_REGEX, t('validacion.soloLetras')),
    correoElectronico: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .max(100)
      .email(t('validacion.correoInvalido')),
    telefono: campoTelefono(),
    paisTelefono: campoPaisTelefono(),
    notas: z.string().max(500).optional().or(z.literal('')),
    canalPreferido: z.enum(['email', 'whatsapp']),
    idiomaPreferido: z.enum(['es', 'en']),
    nivelCliente: z.enum(['gratis', 'premium']),
  });
}

export function crearClienteSchema(t: TFunction) {
  return camposCliente(t).superRefine((valores, ctx) => validarTelefono(valores, ctx, t));
}

export type ClienteFormValues = z.infer<ReturnType<typeof crearClienteSchema>>;

export function crearServicioSchema(t: TFunction) {
  return z.object({
    nombre: z.string().min(2, t('validacion.minimo2Caracteres')).max(60),
    descripcion: z.string().max(500).optional().or(z.literal('')),
    // Mismos límites que CrearServicioDto en el backend (IsInt, Min(1), Max(1440)).
    // Sin z.coerce: el input usa registro con {valueAsNumber: true} (RHF ya
    // entrega number), así el tipo de entrada/salida del resolver coincide y
    // useForm<ServicioFormValues> no choca con TFieldValues (ver ServiciosPage).
    duracionMinutos: z
      .number(t('validacion.numeroInvalido'))
      .int()
      .min(1, t('validacion.duracionMinima'))
      .max(1440),
    // IsPositive() en el backend — un servicio no puede costar 0.
    precio: z.number(t('validacion.numeroInvalido')).positive(t('validacion.precioPositivo')),
    colorCalendario: z
      .string()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, t('validacion.colorInvalido'))
      .optional()
      .or(z.literal('')),
  });
}

export type ServicioFormValues = z.infer<ReturnType<typeof crearServicioSchema>>;

/**
 * Reserva manual del Calendario. El cliente puede ser uno existente o uno
 * nuevo creado en el mismo formulario. Los datos del cliente nuevo se
 * validan con las MISMAS reglas que el formulario de Clientes
 * (`crearClienteSchema`, solo los campos que pide este formulario), así
 * no hay dos versiones de "qué es un cliente válido".
 */
export function crearNuevaReservaSchema(t: TFunction) {
  const datosClienteNuevo = camposCliente(t)
    .pick({ nombreCompleto: true, correoElectronico: true, telefono: true, paisTelefono: true })
    .superRefine((valores, ctx) => validarTelefono(valores, ctx, t));
  return z
    .object({
      modoCliente: z.enum(['existente', 'nuevo']),
      idCliente: z.string(),
      nuevoCliente: z.object({
        nombreCompleto: z.string().max(60),
        correoElectronico: z.string().max(100),
        telefono: campoTelefono(),
        paisTelefono: campoPaisTelefono(),
      }),
      idServicio: z.string().max(100).min(1, t('validacion.seleccionaServicio')),
      idUsuario: z.string().max(100).min(1, t('validacion.seleccionaEmpleado')),
      fecha: z.string().min(1, t('validacion.fechaObligatoria')),
      hora: z.string().min(1, t('validacion.horaObligatoria')),
      notas: z.string().max(500).optional().or(z.literal('')),
    })
    .superRefine((valores, ctx) => {
      if (valores.modoCliente === 'existente') {
        if (!valores.idCliente) {
          ctx.addIssue({
            code: 'custom',
            path: ['idCliente'],
            message: t('validacion.seleccionaCliente'),
          });
        }
        return;
      }
      const resultado = datosClienteNuevo.safeParse(valores.nuevoCliente);
      if (resultado.success) return;
      for (const problema of resultado.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['nuevoCliente', ...problema.path],
          message: problema.message,
        });
      }
    });
}

export type NuevaReservaFormValues = z.infer<ReturnType<typeof crearNuevaReservaSchema>>;
