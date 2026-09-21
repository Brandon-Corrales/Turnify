import { z } from 'zod';
import type { TFunction } from 'i18next';
import { TIPOS_NEGOCIO } from './tipo-negocio';

/**
 * Cada schema es una función que recibe `t()` en vez de una constante — los
 * mensajes de error de validación son "contenido" igual que cualquier
 * label (punto 4 del feedback de QA: el cambio de idioma debe aplicar a
 * TODO, no solo al header). Se reconstruye en cada página con
 * `useMemo(() => crearXSchema(t), [t])` para que cambien al vuelo si el
 * usuario cambia de idioma con el formulario abierto.
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

/**
 * Misma política que EsContrasenaValida() en el backend (apps/backend/src/
 * common/validation/es-contrasena-valida.decorator.ts): 8+ caracteres, al
 * menos una letra y un número. No es código compartido literal (no hay un
 * paquete común entre frontend/backend todavía), pero es la MISMA regla de
 * negocio escrita dos veces a propósito — el backend manda como fuente de
 * verdad final, esto es solo para feedback instantáneo en el formulario
 * (punto 13 del brief: validar en ambos lados sin duplicar la fuente de
 * verdad de las reglas de negocio).
 */
export function crearContrasenaSchema(t: TFunction) {
  const mensaje = t('validacion.contrasenaInvalida');
  return z.string().min(8, mensaje).regex(PASSWORD_REGEX, mensaje);
}

export function crearLoginSchema(t: TFunction) {
  return z.object({
    correoElectronico: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .email(t('validacion.correoInvalido')),
    contrasena: z.string().min(1, t('validacion.contrasenaObligatoria')),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof crearLoginSchema>>;

export function crearRegistroSchema(t: TFunction) {
  return z.object({
    nombreNegocio: z.string().min(2, t('validacion.minimo2Caracteres')).max(150),
    tipoNegocio: z.enum(TIPOS_NEGOCIO, t('validacion.tipoNegocioObligatorio')),
    correoNegocio: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .email(t('validacion.correoInvalido')),
    telefonoNegocio: z.string().max(30).optional().or(z.literal('')),
    nombreCompletoAdmin: z.string().min(2, t('validacion.minimo2Caracteres')).max(150),
    correoAdmin: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .email(t('validacion.correoInvalido')),
    contrasena: crearContrasenaSchema(t),
  });
}

export type RegistroFormValues = z.infer<ReturnType<typeof crearRegistroSchema>>;

export function crearDatosClientePublicoSchema(t: TFunction) {
  return z.object({
    nombreCompleto: z.string().min(2, t('validacion.minimo2Caracteres')).max(150),
    correoElectronico: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .email(t('validacion.correoInvalido')),
    telefono: z.string().max(30).optional().or(z.literal('')),
  });
}

export type DatosClientePublicoFormValues = z.infer<
  ReturnType<typeof crearDatosClientePublicoSchema>
>;

export function crearClienteSchema(t: TFunction) {
  return z.object({
    nombreCompleto: z.string().min(2, t('validacion.minimo2Caracteres')).max(150),
    correoElectronico: z
      .string()
      .min(1, t('validacion.correoObligatorio'))
      .email(t('validacion.correoInvalido')),
    telefono: z.string().max(30).optional().or(z.literal('')),
    notas: z.string().max(500).optional().or(z.literal('')),
    canalPreferido: z.enum(['email', 'whatsapp']),
    idiomaPreferido: z.enum(['es', 'en']),
    nivelCliente: z.enum(['gratis', 'premium']),
  });
}

export type ClienteFormValues = z.infer<ReturnType<typeof crearClienteSchema>>;

export function crearServicioSchema(t: TFunction) {
  return z.object({
    nombre: z.string().min(2, t('validacion.minimo2Caracteres')).max(150),
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

export function crearNuevaReservaSchema(t: TFunction) {
  return z.object({
    idCliente: z.string().min(1, t('validacion.seleccionaCliente')),
    idServicio: z.string().min(1, t('validacion.seleccionaServicio')),
    idUsuario: z.string().min(1, t('validacion.seleccionaEmpleado')),
    fecha: z.string().min(1, t('validacion.fechaObligatoria')),
    hora: z.string().min(1, t('validacion.horaObligatoria')),
    notas: z.string().max(500).optional().or(z.literal('')),
  });
}

export type NuevaReservaFormValues = z.infer<ReturnType<typeof crearNuevaReservaSchema>>;
